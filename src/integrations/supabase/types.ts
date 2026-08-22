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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          accepted_at: string | null
          accepted_ip: string | null
          accepted_user_agent: string | null
          application_id: string
          created_at: string
          id: string
          loan_id: string | null
          status: Database["public"]["Enums"]["contract_status"]
          terms: Json
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          application_id: string
          created_at?: string
          id?: string
          loan_id?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          application_id?: string
          created_at?: string
          id?: string
          loan_id?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
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
      credit_decisions: {
        Row: {
          application_id: string
          created_at: string
          credit_score: number | null
          decided_amount: number | null
          decided_by: string | null
          decided_duration_months: number | null
          decision: string
          id: string
          notes: string | null
          reasons: string[]
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          credit_score?: number | null
          decided_amount?: number | null
          decided_by?: string | null
          decided_duration_months?: number | null
          decision: string
          id?: string
          notes?: string | null
          reasons?: string[]
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          credit_score?: number | null
          decided_amount?: number | null
          decided_by?: string | null
          decided_duration_months?: number | null
          decision?: string
          id?: string
          notes?: string | null
          reasons?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_decisions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
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
      credit_scores: {
        Row: {
          band: string
          computed_at: string
          created_at: string
          factors: Json
          id: string
          score: number
          user_id: string
        }
        Insert: {
          band: string
          computed_at?: string
          created_at?: string
          factors?: Json
          id?: string
          score: number
          user_id: string
        }
        Update: {
          band?: string
          computed_at?: string
          created_at?: string
          factors?: Json
          id?: string
          score?: number
          user_id?: string
        }
        Relationships: []
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
      documents: {
        Row: {
          application_id: string | null
          created_at: string
          document_type: string
          expires_at: string | null
          file_name: string | null
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          document_type: string
          expires_at?: string | null
          file_name?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          document_type?: string
          expires_at?: string | null
          file_name?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantee_transactions: {
        Row: {
          amount: number
          created_at: string
          currency_code: string
          guarantee_id: string
          id: string
          new_status: Database["public"]["Enums"]["guarantee_status"] | null
          notes: string | null
          payment_id: string | null
          performed_by: string | null
          previous_status:
            | Database["public"]["Enums"]["guarantee_status"]
            | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency_code: string
          guarantee_id: string
          id?: string
          new_status?: Database["public"]["Enums"]["guarantee_status"] | null
          notes?: string | null
          payment_id?: string | null
          performed_by?: string | null
          previous_status?:
            | Database["public"]["Enums"]["guarantee_status"]
            | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string
          guarantee_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["guarantee_status"] | null
          notes?: string | null
          payment_id?: string | null
          performed_by?: string | null
          previous_status?:
            | Database["public"]["Enums"]["guarantee_status"]
            | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantee_transactions_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "guarantee_transactions_guarantee_id_fkey"
            columns: ["guarantee_id"]
            isOneToOne: false
            referencedRelation: "guarantees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantee_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantees: {
        Row: {
          application_id: string
          claimed_amount: number
          created_at: string
          currency_code: string
          id: string
          loan_id: string | null
          locked_at: string | null
          notes: string | null
          percentage: number
          received_amount: number
          received_at: string | null
          refunded_amount: number
          released_at: string | null
          required_amount: number
          status: Database["public"]["Enums"]["guarantee_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          claimed_amount?: number
          created_at?: string
          currency_code: string
          id?: string
          loan_id?: string | null
          locked_at?: string | null
          notes?: string | null
          percentage: number
          received_amount?: number
          received_at?: string | null
          refunded_amount?: number
          released_at?: string | null
          required_amount: number
          status?: Database["public"]["Enums"]["guarantee_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          claimed_amount?: number
          created_at?: string
          currency_code?: string
          id?: string
          loan_id?: string | null
          locked_at?: string | null
          notes?: string | null
          percentage?: number
          received_amount?: number
          received_at?: string | null
          refunded_amount?: number
          released_at?: string | null
          required_amount?: number
          status?: Database["public"]["Enums"]["guarantee_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantees_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantees_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "guarantees_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          created_at: string
          decision_notes: string | null
          id: string
          level: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screening_results: Json
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_notes?: string | null
          id?: string
          level?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screening_results?: Json
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision_notes?: string | null
          id?: string
          level?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screening_results?: Json
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_applications: {
        Row: {
          annual_interest_rate: number | null
          approved_amount: number | null
          approved_duration_months: number | null
          assigned_to: string | null
          country_id: string
          created_at: string
          currency_code: string
          decision_at: string | null
          declared_monthly_debt: number | null
          declared_monthly_income: number | null
          disbursed_at: string | null
          duration_months: number
          employment_status: string | null
          guarantee_amount: number | null
          guarantee_percentage: number | null
          id: string
          installment_amount: number | null
          installment_count: number | null
          product_id: string
          purpose: string | null
          reference: string
          repayment_frequency: Database["public"]["Enums"]["repayment_frequency"]
          requested_amount: number
          review_started_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          status_reason: string | null
          submitted_at: string | null
          terms_accepted_at: string | null
          total_interest: number | null
          total_repayable: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_interest_rate?: number | null
          approved_amount?: number | null
          approved_duration_months?: number | null
          assigned_to?: string | null
          country_id: string
          created_at?: string
          currency_code: string
          decision_at?: string | null
          declared_monthly_debt?: number | null
          declared_monthly_income?: number | null
          disbursed_at?: string | null
          duration_months: number
          employment_status?: string | null
          guarantee_amount?: number | null
          guarantee_percentage?: number | null
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          product_id: string
          purpose?: string | null
          reference?: string
          repayment_frequency?: Database["public"]["Enums"]["repayment_frequency"]
          requested_amount: number
          review_started_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          status_reason?: string | null
          submitted_at?: string | null
          terms_accepted_at?: string | null
          total_interest?: number | null
          total_repayable?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_interest_rate?: number | null
          approved_amount?: number | null
          approved_duration_months?: number | null
          assigned_to?: string | null
          country_id?: string
          created_at?: string
          currency_code?: string
          decision_at?: string | null
          declared_monthly_debt?: number | null
          declared_monthly_income?: number | null
          disbursed_at?: string | null
          duration_months?: number
          employment_status?: string | null
          guarantee_amount?: number | null
          guarantee_percentage?: number | null
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          product_id?: string
          purpose?: string | null
          reference?: string
          repayment_frequency?: Database["public"]["Enums"]["repayment_frequency"]
          requested_amount?: number
          review_started_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          status_reason?: string | null
          submitted_at?: string | null
          terms_accepted_at?: string | null
          total_interest?: number | null
          total_repayable?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "loan_applications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_installments: {
        Row: {
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          interest_portion: number
          late_fee: number
          loan_id: string
          paid_at: string | null
          principal_portion: number
          remaining_principal: number
          status: Database["public"]["Enums"]["installment_status"]
          total_payment: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          interest_portion: number
          late_fee?: number
          loan_id: string
          paid_at?: string | null
          principal_portion: number
          remaining_principal: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_payment: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          interest_portion?: number
          late_fee?: number
          loan_id?: string
          paid_at?: string | null
          principal_portion?: number
          remaining_principal?: number
          status?: Database["public"]["Enums"]["installment_status"]
          total_payment?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
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
      loans: {
        Row: {
          amount_paid: number
          annual_interest_rate: number
          application_id: string
          completed_at: string | null
          created_at: string
          currency_code: string
          days_overdue: number
          disbursed_at: string | null
          duration_months: number
          final_due_date: string | null
          first_due_date: string | null
          id: string
          installment_amount: number
          installment_count: number
          missed_installments: number
          outstanding_balance: number
          outstanding_principal: number
          principal_amount: number
          product_id: string
          reference: string
          repayment_frequency: Database["public"]["Enums"]["repayment_frequency"]
          risk_status: Database["public"]["Enums"]["risk_status"]
          status: Database["public"]["Enums"]["loan_status"]
          total_interest: number
          total_repayable: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          annual_interest_rate: number
          application_id: string
          completed_at?: string | null
          created_at?: string
          currency_code: string
          days_overdue?: number
          disbursed_at?: string | null
          duration_months: number
          final_due_date?: string | null
          first_due_date?: string | null
          id?: string
          installment_amount: number
          installment_count: number
          missed_installments?: number
          outstanding_balance: number
          outstanding_principal: number
          principal_amount: number
          product_id: string
          reference?: string
          repayment_frequency: Database["public"]["Enums"]["repayment_frequency"]
          risk_status?: Database["public"]["Enums"]["risk_status"]
          status?: Database["public"]["Enums"]["loan_status"]
          total_interest: number
          total_repayable: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          annual_interest_rate?: number
          application_id?: string
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          days_overdue?: number
          disbursed_at?: string | null
          duration_months?: number
          final_due_date?: string | null
          first_due_date?: string | null
          id?: string
          installment_amount?: number
          installment_count?: number
          missed_installments?: number
          outstanding_balance?: number
          outstanding_principal?: number
          principal_amount?: number
          product_id?: string
          reference?: string
          repayment_frequency?: Database["public"]["Enums"]["repayment_frequency"]
          risk_status?: Database["public"]["Enums"]["risk_status"]
          status?: Database["public"]["Enums"]["loan_status"]
          total_interest?: number
          total_repayable?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "loans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          category: string
          channel: string
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          category: string
          channel?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
      payments: {
        Row: {
          amount: number
          application_id: string | null
          confirmed_at: string | null
          created_at: string
          currency_code: string
          direction: string
          failure_reason: string | null
          id: string
          initiated_at: string
          installment_id: string | null
          loan_id: string | null
          metadata: Json
          payment_method: string | null
          provider_id: string | null
          provider_reference: string | null
          purpose: string
          status: Database["public"]["Enums"]["payment_status"]
          transaction_reference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          application_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency_code: string
          direction?: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          installment_id?: string | null
          loan_id?: string | null
          metadata?: Json
          payment_method?: string | null
          provider_id?: string | null
          provider_reference?: string | null
          purpose?: string
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_reference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          currency_code?: string
          direction?: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string
          installment_id?: string | null
          loan_id?: string | null
          metadata?: Json
          payment_method?: string | null
          provider_id?: string | null
          provider_reference?: string | null
          purpose?: string
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_reference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "loan_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
        ]
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
      support_messages: {
        Row: {
          attachment_path: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal_note: boolean
          ticket_id: string
        }
        Insert: {
          attachment_path?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          ticket_id: string
        }
        Update: {
          attachment_path?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          id: string
          priority: string
          reference: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: string
          reference?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          priority?: string
          reference?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
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
      application_status:
        | "draft"
        | "submitted"
        | "kyc_review"
        | "document_review"
        | "risk_analysis"
        | "guarantee_required"
        | "guarantee_pending"
        | "underwriting"
        | "approved"
        | "contract_pending"
        | "ready_for_disbursement"
        | "disbursed"
        | "active"
        | "completed"
        | "rejected"
        | "cancelled"
        | "defaulted"
        | "on_hold"
      contract_status:
        | "draft"
        | "pending_acceptance"
        | "accepted"
        | "declined"
        | "void"
      document_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "expired"
      guarantee_status:
        | "required"
        | "pending_payment"
        | "received"
        | "locked"
        | "releasable"
        | "refunded"
        | "partially_claimed"
        | "claimed"
        | "cancelled"
      installment_status:
        | "upcoming"
        | "due"
        | "paid"
        | "partially_paid"
        | "late"
        | "missed"
        | "waived"
        | "cancelled"
      kyc_status:
        | "not_started"
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "expired"
      loan_status:
        | "pending_disbursement"
        | "active"
        | "completed"
        | "defaulted"
        | "cancelled"
        | "written_off"
      payment_status:
        | "pending"
        | "processing"
        | "successful"
        | "failed"
        | "refunded"
        | "cancelled"
      repayment_frequency: "weekly" | "biweekly" | "monthly"
      risk_status: "normal" | "warning" | "late" | "serious_delay" | "default"
      ticket_status:
        | "open"
        | "pending_customer"
        | "pending_agent"
        | "resolved"
        | "closed"
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
      application_status: [
        "draft",
        "submitted",
        "kyc_review",
        "document_review",
        "risk_analysis",
        "guarantee_required",
        "guarantee_pending",
        "underwriting",
        "approved",
        "contract_pending",
        "ready_for_disbursement",
        "disbursed",
        "active",
        "completed",
        "rejected",
        "cancelled",
        "defaulted",
        "on_hold",
      ],
      contract_status: [
        "draft",
        "pending_acceptance",
        "accepted",
        "declined",
        "void",
      ],
      document_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "expired",
      ],
      guarantee_status: [
        "required",
        "pending_payment",
        "received",
        "locked",
        "releasable",
        "refunded",
        "partially_claimed",
        "claimed",
        "cancelled",
      ],
      installment_status: [
        "upcoming",
        "due",
        "paid",
        "partially_paid",
        "late",
        "missed",
        "waived",
        "cancelled",
      ],
      kyc_status: [
        "not_started",
        "pending",
        "under_review",
        "approved",
        "rejected",
        "expired",
      ],
      loan_status: [
        "pending_disbursement",
        "active",
        "completed",
        "defaulted",
        "cancelled",
        "written_off",
      ],
      payment_status: [
        "pending",
        "processing",
        "successful",
        "failed",
        "refunded",
        "cancelled",
      ],
      repayment_frequency: ["weekly", "biweekly", "monthly"],
      risk_status: ["normal", "warning", "late", "serious_delay", "default"],
      ticket_status: [
        "open",
        "pending_customer",
        "pending_agent",
        "resolved",
        "closed",
      ],
    },
  },
} as const
