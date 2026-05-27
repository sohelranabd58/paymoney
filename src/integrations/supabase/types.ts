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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_watches: {
        Row: {
          ad_type: string
          chat_id: string
          id: string
          points: number
          watched_at: string
        }
        Insert: {
          ad_type?: string
          chat_id: string
          id?: string
          points: number
          watched_at?: string
        }
        Update: {
          ad_type?: string
          chat_id?: string
          id?: string
          points?: number
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_watches_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["chat_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          banned: boolean
          chat_id: string
          created_at: string
          cycle_ads: number
          flagged: boolean
          last_ad_at: string | null
          last_inapp_at: string | null
          last_ip: string | null
          last_popup_at: string | null
          last_ua: string | null
          level: number
          pending_points: number
          points: number
          tg_first_name: string | null
          tg_last_name: string | null
          tg_photo_url: string | null
          tg_profile_synced_at: string | null
          tg_username: string | null
          total_earned: number
        }
        Insert: {
          banned?: boolean
          chat_id: string
          created_at?: string
          cycle_ads?: number
          flagged?: boolean
          last_ad_at?: string | null
          last_inapp_at?: string | null
          last_ip?: string | null
          last_popup_at?: string | null
          last_ua?: string | null
          level?: number
          pending_points?: number
          points?: number
          tg_first_name?: string | null
          tg_last_name?: string | null
          tg_photo_url?: string | null
          tg_profile_synced_at?: string | null
          tg_username?: string | null
          total_earned?: number
        }
        Update: {
          banned?: boolean
          chat_id?: string
          created_at?: string
          cycle_ads?: number
          flagged?: boolean
          last_ad_at?: string | null
          last_inapp_at?: string | null
          last_ip?: string | null
          last_popup_at?: string | null
          last_ua?: string | null
          level?: number
          pending_points?: number
          points?: number
          tg_first_name?: string | null
          tg_last_name?: string | null
          tg_photo_url?: string | null
          tg_profile_synced_at?: string | null
          tg_username?: string | null
          total_earned?: number
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          chat_id: string
          completed_at: string
          id: string
          status: string
          task_id: string
        }
        Insert: {
          chat_id: string
          completed_at?: string
          id?: string
          status?: string
          task_id: string
        }
        Update: {
          chat_id?: string
          completed_at?: string
          id?: string
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          channel_username: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          reward_points: number
          sort_order: number
          task_type: string
          title: string
          url: string | null
          verify_method: string
        }
        Insert: {
          active?: boolean
          channel_username?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          reward_points?: number
          sort_order?: number
          task_type?: string
          title: string
          url?: string | null
          verify_method?: string
        }
        Update: {
          active?: boolean
          channel_username?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          reward_points?: number
          sort_order?: number
          task_type?: string
          title?: string
          url?: string | null
          verify_method?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      withdraw_methods: {
        Row: {
          created_at: string
          enabled: boolean
          icon: string | null
          id: string
          instructions: string | null
          min_amount: number
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          icon?: string | null
          id?: string
          instructions?: string | null
          min_amount?: number
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          icon?: string | null
          id?: string
          instructions?: string | null
          min_amount?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      withdraw_requests: {
        Row: {
          account: string
          amount: number
          chat_id: string
          created_at: string
          id: string
          method_id: string | null
          method_name: string
          note: string | null
          processed_at: string | null
          redeem_code: string | null
          status: string
        }
        Insert: {
          account: string
          amount: number
          chat_id: string
          created_at?: string
          id?: string
          method_id?: string | null
          method_name: string
          note?: string | null
          processed_at?: string | null
          redeem_code?: string | null
          status?: string
        }
        Update: {
          account?: string
          amount?: number
          chat_id?: string
          created_at?: string
          id?: string
          method_id?: string | null
          method_name?: string
          note?: string | null
          processed_at?: string | null
          redeem_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdraw_requests_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "withdraw_requests_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "withdraw_methods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_ad_atomic: {
        Args: {
          p_ad_type: string
          p_base_points: number
          p_chat_id: string
          p_click_every?: number
          p_cooldown: number
          p_daily_limit: number
          p_last_col: string
          p_multiplier: number
        }
        Returns: {
          cycle_ads: number
          earned: number
          needs_click_ad: boolean
          new_level: number
          new_points: number
          pending_points: number
          today_count: number
        }[]
      }
      claim_click_ad_atomic: {
        Args: { p_bonus: number; p_chat_id: string }
        Returns: {
          bonus: number
          moved: number
          new_points: number
        }[]
      }
      submit_withdraw_atomic: {
        Args: {
          p_account: string
          p_amount: number
          p_chat_id: string
          p_method_id: string
          p_method_name: string
        }
        Returns: string
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
