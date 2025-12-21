-- ============================================================================
-- ADLAUNCH AI DATABASE SCHEMA
-- Assets, Campaigns, Rules, Events - All scoped to auth.uid()
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE (for storing additional user data)
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE public.projects (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Ad Campaigns',
  target_market TEXT DEFAULT 'US',
  language TEXT DEFAULT 'en',
  currency TEXT DEFAULT 'USD',
  default_platforms TEXT[] DEFAULT ARRAY['google', 'tiktok', 'snapchat'],
  stage TEXT NOT NULL DEFAULT 'SETUP',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" 
  ON public.projects FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
  ON public.projects FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
  ON public.projects FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
  ON public.projects FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- AD ACCOUNT CONNECTIONS TABLE
-- ============================================================================

CREATE TABLE public.ad_account_connections (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  permissions JSONB NOT NULL DEFAULT '{"canAnalyze": false, "canLaunch": false, "canMonitor": false}'::jsonb,
  token_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_account_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections" 
  ON public.ad_account_connections FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own connections" 
  ON public.ad_account_connections FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections" 
  ON public.ad_account_connections FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections" 
  ON public.ad_account_connections FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- ASSETS TABLE
-- ============================================================================

CREATE TABLE public.assets (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  content TEXT,
  state TEXT NOT NULL DEFAULT 'UPLOADED',
  risk_score INTEGER,
  quality_score INTEGER,
  platform_compatibility TEXT[] DEFAULT ARRAY['GOOGLE', 'TIKTOK', 'SNAPCHAT'],
  analysis_result JSONB,
  issues JSONB DEFAULT '[]'::jsonb,
  rejection_reasons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assets" 
  ON public.assets FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assets" 
  ON public.assets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets" 
  ON public.assets FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" 
  ON public.assets FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- CAMPAIGN INTENTS TABLE (pre-publish state)
-- ============================================================================

CREATE TABLE public.campaign_intents (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'CONVERSION',
  asset_ids UUID[] NOT NULL DEFAULT '{}',
  account_ids UUID[] NOT NULL DEFAULT '{}',
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget JSONB,
  schedule JSONB,
  state TEXT NOT NULL DEFAULT 'DRAFT',
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaign intents" 
  ON public.campaign_intents FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaign intents" 
  ON public.campaign_intents FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaign intents" 
  ON public.campaign_intents FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaign intents" 
  ON public.campaign_intents FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- CAMPAIGNS TABLE (post-publish state)
-- ============================================================================

CREATE TABLE public.campaigns (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID REFERENCES public.campaign_intents(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_campaign_id TEXT,
  account_id UUID REFERENCES public.ad_account_connections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'CONVERSION',
  state TEXT NOT NULL DEFAULT 'ACTIVE',
  paused_by_user BOOLEAN NOT NULL DEFAULT false,
  budget_daily NUMERIC,
  budget_total NUMERIC,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  first_spend_timestamp TIMESTAMP WITH TIME ZONE,
  actions_today INTEGER DEFAULT 0,
  budget_increased_today_percent NUMERIC DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns" 
  ON public.campaigns FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns" 
  ON public.campaigns FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" 
  ON public.campaigns FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" 
  ON public.campaigns FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- AUTOMATION RULES TABLE
-- ============================================================================

CREATE TABLE public.automation_rules (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'CAMPAIGN',
  condition JSONB NOT NULL,
  action JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'DISABLED',
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  cooldown_ends_at TIMESTAMP WITH TIME ZONE,
  actions_today INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rules" 
  ON public.automation_rules FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rules" 
  ON public.automation_rules FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rules" 
  ON public.automation_rules FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rules" 
  ON public.automation_rules FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- EVENTS TABLE (Normalized Event Schema)
-- ============================================================================

CREATE TABLE public.events (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_state TEXT,
  new_state TEXT,
  action TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events" 
  ON public.events FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events" 
  ON public.events FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Events are immutable - no update or delete policies

-- Index for fast event queries
CREATE INDEX idx_events_user_timestamp ON public.events(user_id, timestamp DESC);
CREATE INDEX idx_events_entity ON public.events(entity_type, entity_id);
CREATE INDEX idx_events_type ON public.events(event_type);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_account_connections_updated_at
  BEFORE UPDATE ON public.ad_account_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_intents_updated_at
  BEFORE UPDATE ON public.campaign_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();