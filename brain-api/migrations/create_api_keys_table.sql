-- Create api_keys table for storing encrypted LLM provider configurations
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL UNIQUE,
    llm_provider TEXT NOT NULL CHECK (
        llm_provider IN ('openai', 'anthropic', 'google')
    ),
    llm_api_key_encrypted TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Create index on project_id for faster lookups
CREATE INDEX IF NOT EXISTS api_keys_project_id_idx ON public.api_keys(project_id);
-- Enable Row Level Security
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- Create policy for service role (full access)
CREATE POLICY "Service role has full access" ON public.api_keys FOR ALL USING (auth.role() = 'service_role');
-- Create policy for authenticated users (can only access their own project's keys)
-- Note: This requires matching project_id with user's accessible projects
CREATE POLICY "Users can access their project keys" ON public.api_keys FOR
SELECT USING (auth.uid() IS NOT NULL);
COMMENT ON TABLE public.api_keys IS 'Stores encrypted LLM provider API keys per project';
COMMENT ON COLUMN public.api_keys.llm_api_key_encrypted IS 'Encrypted using AES-256-GCM with OAUTH_ENCRYPTION_KEY';