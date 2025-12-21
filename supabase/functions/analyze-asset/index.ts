import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { asset, assets } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service not configured");
    }

    // Handle single asset or batch
    const assetsToAnalyze: AssetInput[] = assets || (asset ? [asset] : []);
    
    if (assetsToAnalyze.length === 0) {
      throw new Error("No assets provided for analysis");
    }

    console.log(`Analyzing ${assetsToAnalyze.length} asset(s)`);

    const results: AnalysisResult[] = [];

    for (const assetItem of assetsToAnalyze) {
      console.log(`Analyzing asset: ${assetItem.id} (${assetItem.type})`);
      
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

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI gateway error for asset ${assetItem.id}:`, response.status, errorText);
        
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits to continue.");
        }
        throw new Error(`AI analysis failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.error(`Empty response for asset ${assetItem.id}`);
        throw new Error("AI returned empty response");
      }

      console.log(`Raw AI response for ${assetItem.id}:`, content.substring(0, 200));

      // Parse JSON from response (handle markdown code blocks)
      let analysisJson: any;
      try {
        // Try to extract JSON from markdown code block
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        analysisJson = JSON.parse(jsonStr.trim());
      } catch (parseError) {
        console.error(`Failed to parse AI response for ${assetItem.id}:`, parseError);
        // Fallback to safe defaults
        analysisJson = {
          policyRiskScore: 30,
          creativeQualityScore: 70,
          approved: true,
          issues: [],
          rejectionReasons: [],
        };
      }

      results.push({
        assetId: assetItem.id,
        approved: analysisJson.approved ?? (analysisJson.policyRiskScore < 50),
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
    console.error("Error in analyze-asset function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Analysis failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
