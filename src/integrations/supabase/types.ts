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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      countries: {
        Row: {
          code: string
          compliance_config: Json
          created_at: string
          default_currency: string
          guarantee_percentage: number
          id: string
          is_active: boolean
          kyc_requirements: Json
          lending_enabled: boolean
          name: string
          phone_prefix: string
          updated_at: string
        }
        Insert: {
          code: string
          compliance_config?: Json
          created_at?: string
          default_currency: string
          guarantee_percentage?: number
          id?: string
          is_active?: boolean
          kyc_requirements?: Json
          lending_enabled?: boolean
          name: string
          phone_prefix: string
          updated_at?: string
        }
        Update: {
          code?: string
          compliance_config?: Json
          created_at?: string
          default_currency?: string
          guarantee_percentage?: number
          id?: string
          is_active?: boolean
          kyc_requirements?: Json
          lending_enabled?: boolean
          name?: string
          phone_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "countries_default_currency_fkey"
            columns: ["default_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      credit_limit_rules: {
        Row: {
          country_id: string | null
          created_at: string
          currency_code: string
          id: string
          is_active: boolean
          max_amount: number
          min_credit_score: number
          step_order: number
          successful_loans_required: number
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          currency_code: string
          id?: string
          is_active?: boolean
          max_amount: number
          min_credit_score?: number
          step_order: number
          successful_loans_required?: number
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          is_active?: boolean
          max_amount?: number
          min_credit_score?: number
          step_order?: number
          successful_loans_required?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_limit_rules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_limit_rules_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimal_places: number
          is_active: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      loan_products: {
        Row: {
          allowed_frequencies: Database["public"]["Enums"]["repayment_frequency"][]
          annual_interest_rate: number
          country_id: string
          created_at: string
          currency_code: string
          early_repayment_rules: Json
          eligibility_rules: Json
          guarantee_percentage: number
          id: string
          is_active: boolean
          late_payment_rules: Json
          max_amount: number
          max_duration_months: number
          min_amount: number
          min_duration_months: number
          name: string
          origination_fee_rate: number
          required_documents: string[]
          updated_at: string
        }
        Insert: {
          allowed_frequencies?: Database["public"]["Enums"]["repayment_frequency"][]
          annual_interest_rate: number
          country_id: string
          created_at?: string
          currency_code: string
          early_repayment_rules?: Json
          eligibility_rules?: Json
          guarantee_percentage?: number
          id?: string
          is_active?: boolean
          late_payment_rules?: Json
          max_amount: number
          max_duration_months: number
          min_amount: number
          min_duration_months: number
          name: string
          origination_fee_rate?: number
          required_documents?: string[]
          updated_at?: string
        }
        Update: {
          allowed_frequencies?: Database["public"]["Enums"]["repayment_frequency"][]
          annual_interest_rate?: number
          country_id?: string
          created_at?: string
          currency_code?: string
          early_repayment_rules?: Json
          eligibility_rules?: Json
          guarantee_percentage?: number
          id?: string
          is_active?: boolean
          late_payment_rules?: Json
          max_amount?: number
          max_duration_months?: number
          min_amount?: number
          min_duration_months?: number
          name?: string
          origination_fee_rate?: number
          required_documents?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_products_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_products_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      payment_providers: {
        Row: {
          code: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          supported_country_codes: string[]
          supported_methods: string[]
          updated_at: string
        }
        Insert: {
          code: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          supported_country_codes?: string[]
          supported_methods?: string[]
          updated_at?: string
        }
        Update: {
          code?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          supported_country_codes?: string[]
          supported_methods?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          address_line1: string | null
          address_line2: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          city: string | null
          country_code: string | null
          country_id: string | null
          created_at: string
          credit_limit: number | null
          credit_limit_currency: string | null
          credit_score: number | null
          date_of_birth: string | null
          email: string | null
          email_verified: boolean
          employer_name: string | null
          employment_status: string | null
          first_name: string | null
          id: string
          income_currency: string | null
          kyc_completed: boolean
          last_name: string | null
          mobile_money_number: string | null
          monthly_debt_payments: number | null
          monthly_income: number | null
          phone: string | null
          phone_verified: boolean
          postal_code: string | null
          status_reason: string | null
          successful_loans_count: number
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          country_code?: string | null
          country_id?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_limit_currency?: string | null
          credit_score?: number | null
          date_of_birth?: string | null
          email?: string | null
          email_verified?: boolean
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          id: string
          income_currency?: string | null
          kyc_completed?: boolean
          last_name?: string | null
          mobile_money_number?: string | null
          monthly_debt_payments?: number | null
          monthly_income?: number | null
          phone?: string | null
          phone_verified?: boolean
          postal_code?: string | null
          status_reason?: string | null
          successful_loans_count?: number
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          city?: string | null
          country_code?: string | null
          country_id?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_limit_currency?: string | null
          credit_score?: number | null
          date_of_birth?: string | null
          email?: string | null
          email_verified?: boolean
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          id?: string
          income_currency?: string | null
          kyc_completed?: boolean
          last_name?: string | null
          mobile_money_number?: string | null
          monthly_debt_payments?: number | null
          monthly_income?: number | null
          phone?: string | null
          phone_verified?: boolean
          postal_code?: string | null
          status_reason?: string | null
          successful_loans_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_credit_limit_currency_fkey"
            columns: ["credit_limit_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_income_currency_fkey"
            columns: ["income_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      risk_rules: {
        Row: {
          config: Json
          country_id: string | null
          created_at: string
          id: string
          is_active: boolean
          rule_type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          country_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          rule_type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          country_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_rules_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_status:
        | "pending_verification"
        | "verified"
        | "rejected"
        | "suspended"
        | "blocked"
      app_role: "admin" | "underwriter" | "compliance" | "support" | "customer"
      repayment_frequency: "weekly" | "biweekly" | "monthly"
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
      account_status: [
        "pending_verification",
        "verified",
        "rejected",
        "suspended",
        "blocked",
      ],
      app_role: ["admin", "underwriter", "compliance", "support", "customer"],
      repayment_frequency: ["weekly", "biweekly", "monthly"],
    },
  },
} as const
