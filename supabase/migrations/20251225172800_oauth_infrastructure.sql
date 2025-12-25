-- ============================================================================
-- ADLAUNCH AI - OAUTH INFRASTRUCTURE
-- Production-grade OAuth token storage, state management, and audit logging
-- ============================================================================
-- ============================================================================
-- OAUTH TOKENS TABLE
-- Encrypted token storage, separate from connection metadata
-- ============================================================================
CREATE TABLE public.oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.ad_account_connections(id) ON DELETE CASCADE,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT [],
    platform_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_connection_token UNIQUE (connection_id)
);
-- RLS: Users can only access their own tokens (via connection ownership)
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own tokens via connection" ON public.oauth_tokens FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.ad_account_connections acc
            WHERE acc.id = oauth_tokens.connection_id
                AND acc.user_id = auth.uid()
        )
    );
-- Only service role can insert/update/delete tokens (backend only)
-- No INSERT/UPDATE/DELETE policies for regular users
-- ============================================================================
-- OAUTH STATES TABLE
-- CSRF protection with automatic expiration
-- ============================================================================
CREATE TABLE public.oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('google', 'tiktok', 'snapchat')),
    state_token TEXT NOT NULL UNIQUE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    redirect_after TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: Users can view their own states
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own oauth states" ON public.oauth_states FOR
SELECT USING (auth.uid() = user_id);
-- Index for fast state lookup during callback
CREATE INDEX idx_oauth_states_token ON public.oauth_states(state_token);
CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);
-- ============================================================================
-- OAUTH AUDIT LOG TABLE
-- Immutable log of all OAuth events
-- ============================================================================
CREATE TABLE public.oauth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.ad_account_connections(id) ON DELETE
    SET NULL,
        platform TEXT NOT NULL,
        action TEXT NOT NULL CHECK (
            action IN (
                'connect_start',
                'connect_success',
                'connect_failure',
                'disconnect',
                'refresh_success',
                'refresh_failure',
                'revoke',
                'expire'
            )
        ),
        status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
        error_code TEXT,
        error_message TEXT,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS: Users can view their own audit logs
ALTER TABLE public.oauth_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own oauth audit logs" ON public.oauth_audit_log FOR
SELECT USING (auth.uid() = user_id);
-- Indexes for audit queries
CREATE INDEX idx_oauth_audit_user_time ON public.oauth_audit_log(user_id, created_at DESC);
CREATE INDEX idx_oauth_audit_connection ON public.oauth_audit_log(connection_id);
CREATE INDEX idx_oauth_audit_action ON public.oauth_audit_log(action);
-- ============================================================================
-- UPDATE AD_ACCOUNT_CONNECTIONS TABLE
-- Add status column improvements for OAuth lifecycle
-- ============================================================================
-- Add new status values if not already present
DO $$ BEGIN -- Add 'expired' and 'revoked' as valid status options
-- Existing status values: 'pending', 'connecting', 'connected', 'limited_permission', 'full_access', 'disconnected'
-- The current schema uses TEXT, so we just document the valid values here
NULL;
END $$;
-- Add external_account_id column if not exists
ALTER TABLE public.ad_account_connections
ADD COLUMN IF NOT EXISTS external_account_id TEXT;
-- Add last_refresh_at column for tracking token refresh
ALTER TABLE public.ad_account_connections
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ;
-- Add token_expires_at for quick expiry checks without joining oauth_tokens
ALTER TABLE public.ad_account_connections
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_oauth_tokens_updated_at BEFORE
UPDATE ON public.oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ============================================================================
-- CLEANUP FUNCTION FOR EXPIRED STATES
-- Run periodically via pg_cron or Edge Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states() RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count INTEGER;
BEGIN
DELETE FROM public.oauth_states
WHERE expires_at < now();
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RETURN deleted_count;
END;
$$;
-- ============================================================================
-- HELPER VIEW FOR ACCOUNT STATUS
-- Combines connections with token expiry info
-- ============================================================================
CREATE OR REPLACE VIEW public.ad_accounts_with_status AS
SELECT acc.id,
    acc.project_id,
    acc.user_id,
    acc.platform,
    acc.account_id,
    acc.account_name,
    acc.external_account_id,
    acc.status,
    acc.permissions,
    acc.token_expires_at,
    acc.last_refresh_at,
    acc.created_at,
    acc.updated_at,
    CASE
        WHEN acc.status = 'disconnected' THEN 'disconnected'
        WHEN acc.token_expires_at IS NULL THEN acc.status
        WHEN acc.token_expires_at < now() THEN 'expired'
        WHEN acc.token_expires_at < now() + interval '5 minutes' THEN 'expiring_soon'
        ELSE acc.status
    END AS computed_status
FROM public.ad_account_connections acc;
-- Grant access to the view
ALTER VIEW public.ad_accounts_with_status OWNER TO postgres;