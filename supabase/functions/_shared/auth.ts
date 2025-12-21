import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/**
 * JWT Authentication Helper for Edge Functions
 * 
 * Validates the JWT token from the Authorization header and returns
 * the authenticated user information.
 */

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Extract and validate JWT from Authorization header
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      authenticated: false,
      error: 'Missing Authorization header',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Invalid Authorization header format. Expected: Bearer <token>',
    };
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return {
      authenticated: false,
      error: 'Empty token',
    };
  }

  // Create Supabase client with service role for validation
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the JWT and get the user
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('[auth] JWT validation failed:', error?.message);
    return {
      authenticated: false,
      error: error?.message || 'Invalid or expired token',
    };
  }

  return {
    authenticated: true,
    userId: user.id,
  };
}

/**
 * Create a Supabase client authenticated as the user
 */
export function createUserClient(token: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Create a Supabase client with service role (bypasses RLS)
 * Use with caution - only for admin operations
 */
export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Helper to extract bearer token from request
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
}

/**
 * Standard unauthorized response
 */
export function unauthorizedResponse(reason: string, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'UNAUTHORIZED',
      message: reason,
    }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
