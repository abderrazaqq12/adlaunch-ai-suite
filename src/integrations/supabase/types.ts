export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_account_connections: {
        Row: {
          account_id: string
          account_name: string
          created_at: string
          id: string
          permissions: Json
          platform: string
          project_id: string
          status: string
          token_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_name: string
          created_at?: string
          id?: string
          permissions?: Json
          platform: string
          project_id: string
          status?: string
          token_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_name?: string
          created_at?: string
          id?: string
          permissions?: Json
          platform?: string
          project_id?: string
          status?: string
          token_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_account_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          analysis_result: Json | null
          content: string | null
          created_at: string
          id: string
          issues: Json | null
          name: string
          platform_compatibility: string[] | null
          project_id: string
          quality_score: number | null
          rejection_reasons: Json | null
          risk_score: number | null
          state: string
          type: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          analysis_result?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          issues?: Json | null
          name: string
          platform_compatibility?: string[] | null
          project_id: string
          quality_score?: number | null
          rejection_reasons?: Json | null
          risk_score?: number | null
          state?: string
          type: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          analysis_result?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          issues?: Json | null
          name?: string
          platform_compatibility?: string[] | null
          project_id?: string
          quality_score?: number | null
          rejection_reasons?: Json | null
          risk_score?: number | null
          state?: string
          type?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          holder_id: string
          id: string
          lock_key: string
          project_id: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          holder_id: string
          id?: string
          lock_key: string
          project_id: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          holder_id?: string
          id?: string
          lock_key?: string
          project_id?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action: Json
          actions_today: number | null
          condition: Json
          cooldown_ends_at: string | null
          cooldown_minutes: number
          created_at: string
          id: string
          last_triggered_at: string | null
          name: string
          project_id: string
          scope: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: Json
          actions_today?: number | null
          condition: Json
          cooldown_ends_at?: string | null
          cooldown_minutes?: number
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          name: string
          project_id: string
          scope?: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Json
          actions_today?: number | null
          condition?: Json
          cooldown_ends_at?: string | null
          cooldown_minutes?: number
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          name?: string
          project_id?: string
          scope?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_intents: {
        Row: {
          account_ids: string[]
          asset_ids: string[]
          audience: Json
          budget: Json | null
          created_at: string
          errors: Json | null
          id: string
          name: string
          objective: string
          project_id: string
          schedule: Json | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_ids?: string[]
          asset_ids?: string[]
          audience?: Json
          budget?: Json | null
          created_at?: string
          errors?: Json | null
          id?: string
          name: string
          objective?: string
          project_id: string
          schedule?: Json | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_ids?: string[]
          asset_ids?: string[]
          audience?: Json
          budget?: Json | null
          created_at?: string
          errors?: Json | null
          id?: string
          name?: string
          objective?: string
          project_id?: string
          schedule?: Json | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string | null
          actions_today: number | null
          budget_daily: number | null
          budget_increased_today_percent: number | null
          budget_total: number | null
          clicks: number | null
          conversions: number | null
          created_at: string
          first_spend_timestamp: string | null
          id: string
          impressions: number | null
          intent_id: string | null
          metrics: Json | null
          name: string
          objective: string
          paused_by_user: boolean
          platform: string
          platform_campaign_id: string | null
          project_id: string
          spend: number | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          actions_today?: number | null
          budget_daily?: number | null
          budget_increased_today_percent?: number | null
          budget_total?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          first_spend_timestamp?: string | null
          id?: string
          impressions?: number | null
          intent_id?: string | null
          metrics?: Json | null
          name: string
          objective?: string
          paused_by_user?: boolean
          platform: string
          platform_campaign_id?: string | null
          project_id: string
          spend?: number | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          actions_today?: number | null
          budget_daily?: number | null
          budget_increased_today_percent?: number | null
          budget_total?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          first_spend_timestamp?: string | null
          id?: string
          impressions?: number | null
          intent_id?: string | null
          metrics?: Json | null
          name?: string
          objective?: string
          paused_by_user?: boolean
          platform?: string
          platform_campaign_id?: string | null
          project_id?: string
          spend?: number | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_account_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "campaign_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          action: string | null
          entity_id: string
          entity_type: string
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          new_state: string | null
          previous_state: string | null
          reason: string | null
          source: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action?: string | null
          entity_id: string
          entity_type: string
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          source: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string | null
          entity_id?: string
          entity_type?: string
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          source?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      global_action_limits: {
        Row: {
          actions_reset_at: string
          actions_today: number
          created_at: string
          id: string
          max_actions_per_account_per_day: number
          max_actions_per_day: number
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions_reset_at?: string
          actions_today?: number
          created_at?: string
          id?: string
          max_actions_per_account_per_day?: number
          max_actions_per_day?: number
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions_reset_at?: string
          actions_today?: number
          created_at?: string
          id?: string
          max_actions_per_account_per_day?: number
          max_actions_per_day?: number
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          currency: string | null
          default_platforms: string[] | null
          id: string
          language: string | null
          name: string
          stage: string
          target_market: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          default_platforms?: string[] | null
          id?: string
          language?: string | null
          name?: string
          stage?: string
          target_market?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          default_platforms?: string[] | null
          id?: string
          language?: string | null
          name?: string
          stage?: string
          target_market?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_automation_lock: {
        Args: {
          p_holder_id: string
          p_lock_key: string
          p_project_id: string
          p_ttl_seconds?: number
        }
        Returns: {
          acquired: boolean
          expires_at: string
          holder_id: string
        }[]
      }
      check_rule_cooldown: {
        Args: { p_rule_id: string }
        Returns: {
          cooldown_ends_at: string
          in_cooldown: boolean
          remaining_seconds: number
        }[]
      }
      increment_campaign_action: {
        Args: { p_campaign_id: string; p_cooldown_minutes?: number }
        Returns: {
          cooldown_ends_at: string
          error_message: string
          new_actions_today: number
          success: boolean
        }[]
      }
      increment_global_action: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: {
          actions_reset_at: string
          error_message: string
          new_actions_today: number
          success: boolean
        }[]
      }
      increment_rule_action: {
        Args: { p_cooldown_minutes?: number; p_rule_id: string }
        Returns: {
          cooldown_ends_at: string
          error_message: string
          new_actions_today: number
          success: boolean
        }[]
      }
      release_automation_lock: {
        Args: { p_holder_id: string; p_lock_key: string; p_project_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
