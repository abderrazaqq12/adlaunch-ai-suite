/**
 * CONCURRENCY CONTROL & DEBOUNCE
 * 
 * Provides distributed locking and debounce mechanisms
 * for automation reliability.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// In-memory debounce tracker (per-instance)
const debounceMap = new Map<string, number>();

// Debounce configuration
const DEBOUNCE_MS = 2000; // 2 seconds between same operations

export interface LockResult {
  acquired: boolean;
  holderId?: string;
  expiresAt?: string;
  error?: string;
}

export interface AtomicResult {
  success: boolean;
  newActionsToday?: number;
  cooldownEndsAt?: string;
  error?: string;
}

/**
 * Generate a unique holder ID for this execution
 */
export function generateHolderId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an operation should be debounced
 * Returns true if the operation should proceed, false if debounced
 */
export function shouldProceed(key: string): boolean {
  const now = Date.now();
  const lastExecution = debounceMap.get(key);
  
  if (lastExecution && (now - lastExecution) < DEBOUNCE_MS) {
    console.log(`[Debounce] Skipping ${key} - last execution ${now - lastExecution}ms ago`);
    return false;
  }
  
  debounceMap.set(key, now);
  return true;
}

/**
 * Create debounce key for automation run
 */
export function createAutomationDebounceKey(projectId: string, ruleId?: string): string {
  return ruleId 
    ? `automation:${projectId}:${ruleId}`
    : `automation:${projectId}:all`;
}

/**
 * Acquire a distributed lock using database
 */
export async function acquireLock(
  supabase: SupabaseClient,
  projectId: string,
  lockKey: string,
  holderId: string,
  ttlSeconds: number = 30
): Promise<LockResult> {
  try {
    const { data, error } = await supabase.rpc('acquire_automation_lock', {
      p_project_id: projectId,
      p_lock_key: lockKey,
      p_holder_id: holderId,
      p_ttl_seconds: ttlSeconds,
    });
    
    if (error) {
      console.error('[Lock] Failed to acquire lock:', error);
      return { acquired: false, error: error.message };
    }
    
    if (!data || data.length === 0) {
      return { acquired: false, error: 'No lock result returned' };
    }
    
    const result = data[0];
    return {
      acquired: result.acquired,
      holderId: result.holder_id,
      expiresAt: result.expires_at,
    };
  } catch (err) {
    console.error('[Lock] Exception acquiring lock:', err);
    return { acquired: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Release a distributed lock
 */
export async function releaseLock(
  supabase: SupabaseClient,
  projectId: string,
  lockKey: string,
  holderId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('release_automation_lock', {
      p_project_id: projectId,
      p_lock_key: lockKey,
      p_holder_id: holderId,
    });
    
    if (error) {
      console.error('[Lock] Failed to release lock:', error);
      return false;
    }
    
    return data === true;
  } catch (err) {
    console.error('[Lock] Exception releasing lock:', err);
    return false;
  }
}

/**
 * Atomically increment campaign action counter
 */
export async function incrementCampaignAction(
  supabase: SupabaseClient,
  campaignId: string,
  cooldownMinutes: number = 60
): Promise<AtomicResult> {
  try {
    const { data, error } = await supabase.rpc('increment_campaign_action', {
      p_campaign_id: campaignId,
      p_cooldown_minutes: cooldownMinutes,
    });
    
    if (error) {
      console.error('[Atomic] Failed to increment campaign action:', error);
      return { success: false, error: error.message };
    }
    
    if (!data || data.length === 0) {
      return { success: false, error: 'No result returned' };
    }
    
    const result = data[0];
    return {
      success: result.success,
      newActionsToday: result.new_actions_today,
      cooldownEndsAt: result.cooldown_ends_at,
      error: result.error_message,
    };
  } catch (err) {
    console.error('[Atomic] Exception incrementing campaign action:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Atomically increment rule action counter with cooldown
 */
export async function incrementRuleAction(
  supabase: SupabaseClient,
  ruleId: string,
  cooldownMinutes: number = 60
): Promise<AtomicResult> {
  try {
    const { data, error } = await supabase.rpc('increment_rule_action', {
      p_rule_id: ruleId,
      p_cooldown_minutes: cooldownMinutes,
    });
    
    if (error) {
      console.error('[Atomic] Failed to increment rule action:', error);
      return { success: false, error: error.message };
    }
    
    if (!data || data.length === 0) {
      return { success: false, error: 'No result returned' };
    }
    
    const result = data[0];
    return {
      success: result.success,
      newActionsToday: result.new_actions_today,
      cooldownEndsAt: result.cooldown_ends_at,
      error: result.error_message,
    };
  } catch (err) {
    console.error('[Atomic] Exception incrementing rule action:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Atomically increment global action counter
 */
export async function incrementGlobalAction(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<AtomicResult> {
  try {
    const { data, error } = await supabase.rpc('increment_global_action', {
      p_project_id: projectId,
      p_user_id: userId,
    });
    
    if (error) {
      console.error('[Atomic] Failed to increment global action:', error);
      return { success: false, error: error.message };
    }
    
    if (!data || data.length === 0) {
      return { success: false, error: 'No result returned' };
    }
    
    const result = data[0];
    return {
      success: result.success,
      newActionsToday: result.new_actions_today,
      cooldownEndsAt: result.actions_reset_at,
      error: result.error_message,
    };
  } catch (err) {
    console.error('[Atomic] Exception incrementing global action:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Check rule cooldown using stored timestamp
 */
export async function checkRuleCooldown(
  supabase: SupabaseClient,
  ruleId: string
): Promise<{ inCooldown: boolean; remainingSeconds: number; cooldownEndsAt?: string }> {
  try {
    const { data, error } = await supabase.rpc('check_rule_cooldown', {
      p_rule_id: ruleId,
    });
    
    if (error) {
      console.error('[Cooldown] Failed to check rule cooldown:', error);
      // Fail closed - assume in cooldown
      return { inCooldown: true, remainingSeconds: 60 };
    }
    
    if (!data || data.length === 0) {
      return { inCooldown: false, remainingSeconds: 0 };
    }
    
    const result = data[0];
    return {
      inCooldown: result.in_cooldown,
      remainingSeconds: result.remaining_seconds,
      cooldownEndsAt: result.cooldown_ends_at,
    };
  } catch (err) {
    console.error('[Cooldown] Exception checking rule cooldown:', err);
    // Fail closed
    return { inCooldown: true, remainingSeconds: 60 };
  }
}

/**
 * Execute with lock - ensures only one execution at a time
 */
export async function withLock<T>(
  supabase: SupabaseClient,
  projectId: string,
  lockKey: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 30
): Promise<{ success: boolean; result?: T; error?: string }> {
  const holderId = generateHolderId();
  
  // Try to acquire lock
  const lockResult = await acquireLock(supabase, projectId, lockKey, holderId, ttlSeconds);
  
  if (!lockResult.acquired) {
    return { 
      success: false, 
      error: `Failed to acquire lock: ${lockResult.error || 'Lock held by another process'}` 
    };
  }
  
  console.log(`[Lock] Acquired lock ${lockKey} for project ${projectId}`);
  
  try {
    const result = await fn();
    return { success: true, result };
  } catch (err) {
    console.error(`[Lock] Error during locked execution:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  } finally {
    // Always release lock
    const released = await releaseLock(supabase, projectId, lockKey, holderId);
    console.log(`[Lock] Released lock ${lockKey}: ${released}`);
  }
}
