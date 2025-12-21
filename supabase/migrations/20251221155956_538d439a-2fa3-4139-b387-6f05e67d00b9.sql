-- Add atomic counters and timestamp-based cooldowns
-- Add global action limits table

-- Create automation_locks table for concurrency control
CREATE TABLE IF NOT EXISTS public.automation_locks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL,
    lock_key text NOT NULL,
    acquired_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    holder_id text NOT NULL,
    UNIQUE(project_id, lock_key)
);

-- Enable RLS
ALTER TABLE public.automation_locks ENABLE ROW LEVEL SECURITY;

-- RLS policies for automation_locks
CREATE POLICY "Users can view their own locks" 
ON public.automation_locks 
FOR SELECT 
USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create their own locks" 
ON public.automation_locks 
FOR INSERT 
WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their own locks" 
ON public.automation_locks 
FOR DELETE 
USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

-- Create global_action_limits table
CREATE TABLE IF NOT EXISTS public.global_action_limits (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL UNIQUE,
    user_id uuid NOT NULL,
    actions_today integer NOT NULL DEFAULT 0,
    actions_reset_at timestamp with time zone NOT NULL DEFAULT (date_trunc('day', now()) + interval '1 day'),
    max_actions_per_day integer NOT NULL DEFAULT 50,
    max_actions_per_account_per_day integer NOT NULL DEFAULT 10,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_action_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for global_action_limits
CREATE POLICY "Users can view their own limits" 
ON public.global_action_limits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own limits" 
ON public.global_action_limits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own limits" 
ON public.global_action_limits 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_global_action_limits_updated_at
BEFORE UPDATE ON public.global_action_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to atomically increment campaign action counter and set cooldown
CREATE OR REPLACE FUNCTION public.increment_campaign_action(
    p_campaign_id uuid,
    p_cooldown_minutes integer DEFAULT 60
)
RETURNS TABLE(
    success boolean,
    new_actions_today integer,
    cooldown_ends_at timestamp with time zone,
    error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_actions integer;
    v_max_actions integer := 3;
    v_cooldown_end timestamp with time zone;
BEGIN
    -- Atomic increment with check
    UPDATE campaigns
    SET 
        actions_today = COALESCE(actions_today, 0) + 1,
        updated_at = now()
    WHERE id = p_campaign_id
      AND COALESCE(actions_today, 0) < v_max_actions
    RETURNING actions_today INTO v_current_actions;
    
    IF v_current_actions IS NULL THEN
        -- Either campaign doesn't exist or limit exceeded
        SELECT actions_today INTO v_current_actions FROM campaigns WHERE id = p_campaign_id;
        IF v_current_actions IS NULL THEN
            RETURN QUERY SELECT false, 0, now(), 'Campaign not found'::text;
        ELSE
            RETURN QUERY SELECT false, v_current_actions, now(), 'Daily action limit exceeded'::text;
        END IF;
        RETURN;
    END IF;
    
    v_cooldown_end := now() + (p_cooldown_minutes * interval '1 minute');
    
    RETURN QUERY SELECT true, v_current_actions, v_cooldown_end, NULL::text;
END;
$$;

-- Function to atomically increment rule action counter and set cooldown timestamp
CREATE OR REPLACE FUNCTION public.increment_rule_action(
    p_rule_id uuid,
    p_cooldown_minutes integer DEFAULT 60
)
RETURNS TABLE(
    success boolean,
    new_actions_today integer,
    cooldown_ends_at timestamp with time zone,
    error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_cooldown timestamp with time zone;
    v_new_cooldown timestamp with time zone;
    v_actions integer;
BEGIN
    -- Check current cooldown
    SELECT cooldown_ends_at, actions_today INTO v_current_cooldown, v_actions
    FROM automation_rules
    WHERE id = p_rule_id;
    
    IF v_current_cooldown IS NOT NULL AND v_current_cooldown > now() THEN
        RETURN QUERY SELECT false, COALESCE(v_actions, 0), v_current_cooldown, 'Rule is in cooldown'::text;
        RETURN;
    END IF;
    
    v_new_cooldown := now() + (p_cooldown_minutes * interval '1 minute');
    
    -- Atomic update
    UPDATE automation_rules
    SET 
        last_triggered_at = now(),
        cooldown_ends_at = v_new_cooldown,
        actions_today = COALESCE(actions_today, 0) + 1,
        updated_at = now()
    WHERE id = p_rule_id
    RETURNING actions_today INTO v_actions;
    
    IF v_actions IS NULL THEN
        RETURN QUERY SELECT false, 0, now(), 'Rule not found'::text;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, v_actions, v_new_cooldown, NULL::text;
END;
$$;

-- Function to atomically increment global action counter
CREATE OR REPLACE FUNCTION public.increment_global_action(
    p_project_id uuid,
    p_user_id uuid
)
RETURNS TABLE(
    success boolean,
    new_actions_today integer,
    actions_reset_at timestamp with time zone,
    error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actions integer;
    v_max_actions integer;
    v_reset_at timestamp with time zone;
BEGIN
    -- Upsert with reset logic
    INSERT INTO global_action_limits (project_id, user_id, actions_today, actions_reset_at)
    VALUES (p_project_id, p_user_id, 1, date_trunc('day', now()) + interval '1 day')
    ON CONFLICT (project_id) 
    DO UPDATE SET
        actions_today = CASE 
            WHEN global_action_limits.actions_reset_at <= now() THEN 1
            ELSE global_action_limits.actions_today + 1
        END,
        actions_reset_at = CASE 
            WHEN global_action_limits.actions_reset_at <= now() THEN date_trunc('day', now()) + interval '1 day'
            ELSE global_action_limits.actions_reset_at
        END,
        updated_at = now()
    RETURNING actions_today, max_actions_per_day, actions_reset_at INTO v_actions, v_max_actions, v_reset_at;
    
    IF v_actions > v_max_actions THEN
        -- Rollback the increment
        UPDATE global_action_limits
        SET actions_today = actions_today - 1
        WHERE project_id = p_project_id;
        
        RETURN QUERY SELECT false, v_max_actions, v_reset_at, 'Global daily action limit exceeded'::text;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, v_actions, v_reset_at, NULL::text;
END;
$$;

-- Function to acquire a lock with expiration
CREATE OR REPLACE FUNCTION public.acquire_automation_lock(
    p_project_id uuid,
    p_lock_key text,
    p_holder_id text,
    p_ttl_seconds integer DEFAULT 30
)
RETURNS TABLE(
    acquired boolean,
    holder_id text,
    expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expires timestamp with time zone;
    v_holder text;
BEGIN
    v_expires := now() + (p_ttl_seconds * interval '1 second');
    
    -- Try to insert new lock or update expired one
    INSERT INTO automation_locks (project_id, lock_key, holder_id, expires_at)
    VALUES (p_project_id, p_lock_key, p_holder_id, v_expires)
    ON CONFLICT (project_id, lock_key) 
    DO UPDATE SET
        holder_id = CASE 
            WHEN automation_locks.expires_at <= now() THEN p_holder_id
            ELSE automation_locks.holder_id
        END,
        expires_at = CASE 
            WHEN automation_locks.expires_at <= now() THEN v_expires
            ELSE automation_locks.expires_at
        END,
        acquired_at = CASE 
            WHEN automation_locks.expires_at <= now() THEN now()
            ELSE automation_locks.acquired_at
        END
    RETURNING automation_locks.holder_id, automation_locks.expires_at INTO v_holder, v_expires;
    
    RETURN QUERY SELECT v_holder = p_holder_id, v_holder, v_expires;
END;
$$;

-- Function to release a lock
CREATE OR REPLACE FUNCTION public.release_automation_lock(
    p_project_id uuid,
    p_lock_key text,
    p_holder_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM automation_locks
    WHERE project_id = p_project_id
      AND lock_key = p_lock_key
      AND holder_id = p_holder_id;
    
    RETURN FOUND;
END;
$$;

-- Function to check cooldown using stored timestamp (no Date math)
CREATE OR REPLACE FUNCTION public.check_rule_cooldown(
    p_rule_id uuid
)
RETURNS TABLE(
    in_cooldown boolean,
    cooldown_ends_at timestamp with time zone,
    remaining_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cooldown_ends timestamp with time zone;
BEGIN
    SELECT ar.cooldown_ends_at INTO v_cooldown_ends
    FROM automation_rules ar
    WHERE ar.id = p_rule_id;
    
    IF v_cooldown_ends IS NULL OR v_cooldown_ends <= now() THEN
        RETURN QUERY SELECT false, v_cooldown_ends, 0;
    ELSE
        RETURN QUERY SELECT 
            true, 
            v_cooldown_ends, 
            EXTRACT(EPOCH FROM (v_cooldown_ends - now()))::integer;
    END IF;
END;
$$;