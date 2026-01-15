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
      complaints: {
        Row: {
          complaint_type: string
          created_at: string
          description: string
          id: string
          latitude: number | null
          location_name: string
          longitude: number | null
          status: Database["public"]["Enums"]["complaint_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          complaint_type: string
          created_at?: string
          description: string
          id?: string
          latitude?: number | null
          location_name: string
          longitude?: number | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          complaint_type?: string
          created_at?: string
          description?: string
          id?: string
          latitude?: number | null
          location_name?: string
          longitude?: number | null
          status?: Database["public"]["Enums"]["complaint_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      crime_data: {
        Row: {
          created_at: string
          crime_type: string
          id: string
          incident_count: number
          latitude: number
          longitude: number
          recorded_date: string
          risk_score: number
          zone_name: string
        }
        Insert: {
          created_at?: string
          crime_type: string
          id?: string
          incident_count?: number
          latitude: number
          longitude: number
          recorded_date?: string
          risk_score?: number
          zone_name: string
        }
        Update: {
          created_at?: string
          crime_type?: string
          id?: string
          incident_count?: number
          latitude?: number
          longitude?: number
          recorded_date?: string
          risk_score?: number
          zone_name?: string
        }
        Relationships: []
      }
      high_risk_zones: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          radius_meters: number
          risk_level: string
          updated_at: string
          zone_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          radius_meters?: number
          risk_level: string
          updated_at?: string
          zone_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          radius_meters?: number
          risk_level?: string
          updated_at?: string
          zone_name?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          assigned_officer: string | null
          created_at: string
          description: string | null
          id: string
          incident_type: string
          latitude: number
          location_name: string
          longitude: number
          reported_by: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_officer?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incident_type: string
          latitude: number
          location_name: string
          longitude: number
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_officer?: string | null
          created_at?: string
          description?: string | null
          id?: string
          incident_type?: string
          latitude?: number
          location_name?: string
          longitude?: number
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sos_alerts: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          resolved_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          resolved_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          resolved_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          accuracy: number | null
          id: string
          is_tracking_enabled: boolean
          last_updated: string
          latitude: number
          longitude: number
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          id?: string
          is_tracking_enabled?: boolean
          last_updated?: string
          latitude: number
          longitude: number
          user_id: string
        }
        Update: {
          accuracy?: number | null
          id?: string
          is_tracking_enabled?: boolean
          last_updated?: string
          latitude?: number
          longitude?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "citizen" | "police" | "admin"
      complaint_status: "pending" | "in_progress" | "resolved" | "closed"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status: "reported" | "investigating" | "resolved" | "closed"
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
    Enums: {
      app_role: ["citizen", "police", "admin"],
      complaint_status: ["pending", "in_progress", "resolved", "closed"],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: ["reported", "investigating", "resolved", "closed"],
    },
  },
} as const
