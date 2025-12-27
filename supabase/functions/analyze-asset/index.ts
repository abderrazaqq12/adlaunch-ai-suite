import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, unauthorizedResponse, createUserClient, extractBearerToken } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gemini-key',
};

interface AssetInput {
  id: string;
  type: 'video' | 'image' | 'text';
  name: string;
  url?: string;
  content?: string;
}

interface ComplianceIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'policy' | 'creative' | 'content' | 'technical';
  message: string;
  recommendation?: string;
}

interface AnalysisResult {
  assetId: string;
  approved: boolean;
  policyRiskScore: number;
  creativeQualityScore: number;
  issues: ComplianceIssue[];
  rejectionReasons: string[];
  analyzedAt: string;
}

const SYSTEM_PROMPT = `You are an AI advertising compliance analyst for digital advertising platforms (Google Ads, TikTok Ads, Snapchat Ads).

Your job is to analyze creative assets and provide:
1. A policy risk score (0-100, where 0 = no risk, 100 = guaranteed rejection)
2. A creative quality score (0-100, where 100 = excellent creative)
3. Specific compliance issues found
4. Whether the asset should be approved or rejected

Consider these advertising policies:
- No misleading claims or exaggerated promises
- No prohibited content (weapons, drugs, adult content, hate speech)
- No excessive text overlays (>20% of visual area)
- No copyrighted content without permission
- No clickbait or sensationalist content
- Must have clear branding and call-to-action
- Audio/video must be high quality and appropriate
- Must comply with platform-specific creative requirements

Be thorough but fair. Minor issues should result in warnings, not rejections.`;

// Helper to emit events to the events table
async function emitEvent(
  supabase: any,
  userId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  data: {
    previousState?: string;
    newState?: string;
    action?: string;
    reason?: string;
    metadata?: Record<string, any>;
  }
) {
  const event = {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    source: 'AI',
    entity_type: entityType,
    entity_id: entityId,
    user_id: userId,
    previous_state: data.previousState,
    new_state: data.newState,
    action: data.action,
    reason: data.reason,
    metadata: data.metadata || {},
  };

  const { error } = await supabase.from('events').insert(event);
  if (error) {
    console.error('[analyze-asset] Failed to emit event:', error);
  }
  return event;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate request
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    return unauthorizedResponse(authResult.error || 'Unauthorized', corsHeaders);
  }
  const userId = authResult.userId!;

  const token = extractBearerToken(req);
  if (!token) {
    return unauthorizedResponse('Missing token', corsHeaders);
  }

  const supabase = createUserClient(token);

  try {
    const { asset, assets, projectId } = await req.json();

    // Get Gemini API key from header (user-provided) or fallback to env
    const geminiApiKey = req.headers.get('X-Gemini-Key') || Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      console.error("[analyze-asset] No Gemini API key provided");
      throw new Error("Gemini API key not configured. Please add your API key in Settings.");
    }

    // Handle single asset or batch
    const assetsToAnalyze: AssetInput[] = assets || (asset ? [asset] : []);

    if (assetsToAnalyze.length === 0) {
      throw new Error("No assets provided for analysis");
    }

    console.log(`[analyze-asset] Analyzing ${assetsToAnalyze.length} asset(s) for user=${userId}`);

    const results: AnalysisResult[] = [];

    for (const assetItem of assetsToAnalyze) {
      console.log(`[analyze-asset] Analyzing asset: ${assetItem.id} (${assetItem.type})`);

      // Get current asset state from database
      const { data: dbAsset } = await supabase
        .from('assets')
        .select('state')
        .eq('id', assetItem.id)
        .single();

      const previousState = dbAsset?.state || 'UPLOADED';

      const userPrompt = `Analyze this advertising creative asset:

Asset ID: ${assetItem.id}
Asset Type: ${assetItem.type}
Asset Name: ${assetItem.name}
${assetItem.url ? `URL: ${assetItem.url}` : ''}
${assetItem.content ? `Content/Copy: ${assetItem.content}` : ''}

Provide your analysis as a JSON object with this structure:
{
  "policyRiskScore": <number 0-100>,
  "creativeQualityScore": <number 0-100>,
  "approved": <boolean>,
  "issues": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "category": "policy" | "creative" | "content" | "technical",
      "message": "<issue description>",
      "recommendation": "<how to fix>"
    }
  ],
  "rejectionReasons": ["<reason1>", "<reason2>"]
}

Only include rejectionReasons for high or critical severity issues that warrant rejection.`;

      // Call Google Gemini API directly
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze-asset] Gemini API error for asset ${assetItem.id}:`, response.status, errorText);

        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (response.status === 400) {
          throw new Error("Invalid Gemini API key. Please check your API key in Settings.");
        }
        throw new Error(`AI analysis failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.error(`[analyze-asset] Empty response for asset ${assetItem.id}:`, JSON.stringify(data));
        throw new Error("AI returned empty response");
      }

      console.log(`[analyze-asset] Raw AI response for ${assetItem.id}:`, content.substring(0, 200));

      // Parse JSON from response (handle markdown code blocks)
      let analysisJson: any;
      try {
        // Try to extract JSON from markdown code block
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        analysisJson = JSON.parse(jsonStr.trim());
      } catch (parseError) {
        console.error(`[analyze-asset] Failed to parse AI response for ${assetItem.id}:`, parseError);
        // Fallback to safe defaults
        analysisJson = {
          policyRiskScore: 30,
          creativeQualityScore: 70,
          approved: true,
          issues: [],
          rejectionReasons: [],
        };
      }

      const approved = analysisJson.approved ?? (analysisJson.policyRiskScore < 50);
      const newState = approved ? 'APPROVED' : 'BLOCKED';

      // Update asset in database
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          state: newState,
          risk_score: Math.min(100, Math.max(0, analysisJson.policyRiskScore ?? 30)),
          quality_score: Math.min(100, Math.max(0, analysisJson.creativeQualityScore ?? 70)),
          issues: analysisJson.issues ?? [],
          rejection_reasons: analysisJson.rejectionReasons ?? [],
          analysis_result: analysisJson,
        })
        .eq('id', assetItem.id);

      if (updateError) {
        console.error(`[analyze-asset] Failed to update asset ${assetItem.id}:`, updateError);
      }

      // Emit appropriate event
      await emitEvent(supabase, userId, approved ? 'ASSET_APPROVED' : 'ASSET_BLOCKED', 'ASSET', assetItem.id, {
        previousState,
        newState,
        action: 'analyze',
        reason: approved ? undefined : analysisJson.rejectionReasons?.[0],
        metadata: {
          policyRiskScore: analysisJson.policyRiskScore,
          creativeQualityScore: analysisJson.creativeQualityScore,
          issueCount: (analysisJson.issues ?? []).length,
        },
      });

      results.push({
        assetId: assetItem.id,
        approved,
        policyRiskScore: Math.min(100, Math.max(0, analysisJson.policyRiskScore ?? 30)),
        creativeQualityScore: Math.min(100, Math.max(0, analysisJson.creativeQualityScore ?? 70)),
        issues: analysisJson.issues ?? [],
        rejectionReasons: analysisJson.rejectionReasons ?? [],
        analyzedAt: new Date().toISOString(),
      });
    }

    // Return appropriate format based on input
    if (assets) {
      // Batch response
      return new Response(JSON.stringify({
        results,
        summary: {
          total: results.length,
          approved: results.filter(r => r.approved).length,
          rejected: results.filter(r => !r.approved).length,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Single asset response
      return new Response(JSON.stringify(results[0]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error("[analyze-asset] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Analysis failed"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
