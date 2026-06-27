export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_delete_tokens: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          token: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_delete_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      action_proposal: {
        Row: {
          action_key: string;
          action_type: string;
          app_key: string;
          connection_id: string | null;
          conversation_id: string;
          created_at: string;
          human_label: string;
          id: string;
          input_schema: string;
          inputs: string;
          mastra_run_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          action_key: string;
          action_type: string;
          app_key: string;
          connection_id?: string | null;
          conversation_id: string;
          created_at: string;
          human_label: string;
          id: string;
          input_schema: string;
          inputs: string;
          mastra_run_id?: string | null;
          status: string;
          updated_at: string;
        };
        Update: {
          action_key?: string;
          action_type?: string;
          app_key?: string;
          connection_id?: string | null;
          conversation_id?: string;
          created_at?: string;
          human_label?: string;
          id?: string;
          input_schema?: string;
          inputs?: string;
          mastra_run_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_proposal_conversation_id_conversation_id_fk";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversation";
            referencedColumns: ["id"];
          },
        ];
      };
      action_run: {
        Row: {
          error: string | null;
          executed_at: string;
          id: string;
          proposal_id: string;
          result: string;
        };
        Insert: {
          error?: string | null;
          executed_at: string;
          id: string;
          proposal_id: string;
          result: string;
        };
        Update: {
          error?: string | null;
          executed_at?: string;
          id?: string;
          proposal_id?: string;
          result?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_run_proposal_id_action_proposal_id_fk";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "action_proposal";
            referencedColumns: ["id"];
          },
        ];
      };
      api_key: {
        Row: {
          created_at: string;
          id: string;
          key_hash: string;
          last_used_at: string | null;
          name: string;
          scopes: string;
          user_id: string;
        };
        Insert: {
          created_at: string;
          id: string;
          key_hash: string;
          last_used_at?: string | null;
          name: string;
          scopes: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          key_hash?: string;
          last_used_at?: string | null;
          name?: string;
          scopes?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_key_user_id_user_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
        ];
      };
      app_catalog: {
        Row: {
          action_count: number | null;
          app_key: string;
          auth_type: string | null;
          categories: string;
          embedding_text: string | null;
          slug: string;
          synced_at: string;
          title: string;
        };
        Insert: {
          action_count?: number | null;
          app_key: string;
          auth_type?: string | null;
          categories: string;
          embedding_text?: string | null;
          slug: string;
          synced_at: string;
          title: string;
        };
        Update: {
          action_count?: number | null;
          app_key?: string;
          auth_type?: string | null;
          categories?: string;
          embedding_text?: string | null;
          slug?: string;
          synced_at?: string;
          title?: string;
        };
        Relationships: [];
      };
      app_data_snapshot: {
        Row: {
          app_key: string;
          created_at: string;
          id: string;
          records: string;
          refreshed_at: string;
          row_count: number;
          source_config: string;
          trigger_id: string | null;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          app_key: string;
          created_at: string;
          id: string;
          records: string;
          refreshed_at: string;
          row_count?: number;
          source_config: string;
          trigger_id?: string | null;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          app_key?: string;
          created_at?: string;
          id?: string;
          records?: string;
          refreshed_at?: string;
          row_count?: number;
          source_config?: string;
          trigger_id?: string | null;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "app_data_snapshot_workspace_id_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          id: boolean;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      artifact: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          snapshot_id: string | null;
          source_config: string | null;
          spec: string;
          title: string;
          updated_at: string;
          user_id: string;
          version: number;
          visibility: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at: string;
          id: string;
          kind?: string;
          snapshot_id?: string | null;
          source_config?: string | null;
          spec: string;
          title: string;
          updated_at: string;
          user_id: string;
          version?: number;
          visibility?: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          snapshot_id?: string | null;
          source_config?: string | null;
          spec?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "artifact_workspace_id_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      automation: {
        Row: {
          connections: Json;
          created_at: string;
          description: string | null;
          editor_url: string | null;
          enabled: boolean;
          id: string;
          name: string;
          source: string;
          status: string;
          trigger: Json | null;
          trigger_inbox_id: string | null;
          trigger_url: string | null;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
          zapier_version_id: string | null;
          zapier_workflow_id: string;
        };
        Insert: {
          connections?: Json;
          created_at: string;
          description?: string | null;
          editor_url?: string | null;
          enabled?: boolean;
          id: string;
          name: string;
          source: string;
          status?: string;
          trigger?: Json | null;
          trigger_inbox_id?: string | null;
          trigger_url?: string | null;
          updated_at: string;
          user_id: string;
          workspace_id?: string | null;
          zapier_version_id?: string | null;
          zapier_workflow_id: string;
        };
        Update: {
          connections?: Json;
          created_at?: string;
          description?: string | null;
          editor_url?: string | null;
          enabled?: boolean;
          id?: string;
          name?: string;
          source?: string;
          status?: string;
          trigger?: Json | null;
          trigger_inbox_id?: string | null;
          trigger_url?: string | null;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
          zapier_version_id?: string | null;
          zapier_workflow_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_workspace_id_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_run: {
        Row: {
          automation_id: string;
          created_at: string;
          durable_run_id: string | null;
          error: Json | null;
          id: string;
          inbox_message_id: string | null;
          input: Json | null;
          output: Json | null;
          status: string;
          trigger_id: string | null;
          updated_at: string;
          workflow_version_id: string | null;
          workspace_id: string | null;
        };
        Insert: {
          automation_id: string;
          created_at: string;
          durable_run_id?: string | null;
          error?: Json | null;
          id: string;
          inbox_message_id?: string | null;
          input?: Json | null;
          output?: Json | null;
          status?: string;
          trigger_id?: string | null;
          updated_at: string;
          workflow_version_id?: string | null;
          workspace_id?: string | null;
        };
        Update: {
          automation_id?: string;
          created_at?: string;
          durable_run_id?: string | null;
          error?: Json | null;
          id?: string;
          inbox_message_id?: string | null;
          input?: Json | null;
          output?: Json | null;
          status?: string;
          trigger_id?: string | null;
          updated_at?: string;
          workflow_version_id?: string | null;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "automation_run_automation_id_fk";
            columns: ["automation_id"];
            isOneToOne: false;
            referencedRelation: "automation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_run_workspace_id_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_customers: {
        Row: {
          billing_email: string | null;
          gateway_customer_id: string;
          gateway_name: string;
          workspace_id: string;
        };
        Insert: {
          billing_email?: string | null;
          gateway_customer_id: string;
          gateway_name?: string;
          workspace_id: string;
        };
        Update: {
          billing_email?: string | null;
          gateway_customer_id?: string;
          gateway_name?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_customers_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_invoices: {
        Row: {
          amount_due: number;
          amount_paid: number;
          created_at: string;
          currency: string;
          gateway_customer_id: string | null;
          hosted_invoice_url: string | null;
          id: string;
          invoice_pdf: string | null;
          period_end: string | null;
          period_start: string | null;
          status: string | null;
          subscription_id: string | null;
          workspace_id: string;
        };
        Insert: {
          amount_due?: number;
          amount_paid?: number;
          created_at?: string;
          currency?: string;
          gateway_customer_id?: string | null;
          hosted_invoice_url?: string | null;
          id: string;
          invoice_pdf?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status?: string | null;
          subscription_id?: string | null;
          workspace_id: string;
        };
        Update: {
          amount_due?: number;
          amount_paid?: number;
          created_at?: string;
          currency?: string;
          gateway_customer_id?: string | null;
          hosted_invoice_url?: string | null;
          id?: string;
          invoice_pdf?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status?: string | null;
          subscription_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_invoices_gateway_customer_id_fkey";
            columns: ["gateway_customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["gateway_customer_id"];
          },
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "billing_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_invoices_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_one_time_payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          gateway_customer_id: string | null;
          id: string;
          metadata: Json | null;
          status: string | null;
          workspace_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          gateway_customer_id?: string | null;
          id: string;
          metadata?: Json | null;
          status?: string | null;
          workspace_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          gateway_customer_id?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_one_time_payments_gateway_customer_id_fkey";
            columns: ["gateway_customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["gateway_customer_id"];
          },
          {
            foreignKeyName: "billing_one_time_payments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_payment_methods: {
        Row: {
          brand: string | null;
          created_at: string;
          exp_month: number | null;
          exp_year: number | null;
          gateway_customer_id: string | null;
          id: string;
          is_default: boolean;
          last4: string | null;
          type: string;
          workspace_id: string;
        };
        Insert: {
          brand?: string | null;
          created_at?: string;
          exp_month?: number | null;
          exp_year?: number | null;
          gateway_customer_id?: string | null;
          id: string;
          is_default?: boolean;
          last4?: string | null;
          type: string;
          workspace_id: string;
        };
        Update: {
          brand?: string | null;
          created_at?: string;
          exp_month?: number | null;
          exp_year?: number | null;
          gateway_customer_id?: string | null;
          id?: string;
          is_default?: boolean;
          last4?: string | null;
          type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_payment_methods_gateway_customer_id_fkey";
            columns: ["gateway_customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["gateway_customer_id"];
          },
          {
            foreignKeyName: "billing_payment_methods_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_prices: {
        Row: {
          created_at: string;
          currency: string;
          free_trial_days: number | null;
          id: string;
          is_active: boolean;
          metadata: Json | null;
          product_id: string;
          recurring_interval: Database["public"]["Enums"]["pricing_plan_interval"] | null;
          tier: string | null;
          unit_amount: number | null;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          free_trial_days?: number | null;
          id: string;
          is_active?: boolean;
          metadata?: Json | null;
          product_id: string;
          recurring_interval?: Database["public"]["Enums"]["pricing_plan_interval"] | null;
          tier?: string | null;
          unit_amount?: number | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          free_trial_days?: number | null;
          id?: string;
          is_active?: boolean;
          metadata?: Json | null;
          product_id?: string;
          recurring_interval?: Database["public"]["Enums"]["pricing_plan_interval"] | null;
          tier?: string | null;
          unit_amount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "billing_products";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_products: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          metadata: Json | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          is_active?: boolean;
          metadata?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          metadata?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_subscriptions: {
        Row: {
          cancel_at: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          ended_at: string | null;
          gateway_customer_id: string;
          id: string;
          is_trial: boolean;
          metadata: Json | null;
          price_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_end: string | null;
          trial_start: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          cancel_at?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          ended_at?: string | null;
          gateway_customer_id: string;
          id: string;
          is_trial?: boolean;
          metadata?: Json | null;
          price_id?: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          cancel_at?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          ended_at?: string | null;
          gateway_customer_id?: string;
          id?: string;
          is_trial?: boolean;
          metadata?: Json | null;
          price_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_gateway_customer_id_fkey";
            columns: ["gateway_customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["gateway_customer_id"];
          },
          {
            foreignKeyName: "billing_subscriptions_price_id_fkey";
            columns: ["price_id"];
            isOneToOne: false;
            referencedRelation: "billing_prices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_subscriptions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_usage_logs: {
        Row: {
          id: string;
          metric: string;
          quantity: number;
          recorded_at: string;
          subscription_id: string | null;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          metric: string;
          quantity?: number;
          recorded_at?: string;
          subscription_id?: string | null;
          workspace_id: string;
        };
        Update: {
          id?: string;
          metric?: string;
          quantity?: number;
          recorded_at?: string;
          subscription_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_usage_logs_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "billing_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_usage_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_volume_tiers: {
        Row: {
          flat_amount: number | null;
          id: string;
          price_id: string;
          unit_amount: number | null;
          up_to: number | null;
        };
        Insert: {
          flat_amount?: number | null;
          id?: string;
          price_id: string;
          unit_amount?: number | null;
          up_to?: number | null;
        };
        Update: {
          flat_amount?: number | null;
          id?: string;
          price_id?: string;
          unit_amount?: number | null;
          up_to?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_volume_tiers_price_id_fkey";
            columns: ["price_id"];
            isOneToOne: false;
            referencedRelation: "billing_prices";
            referencedColumns: ["id"];
          },
        ];
      };
      capability_flag: {
        Row: {
          capability: string;
          enabled: boolean;
          user_id: string;
        };
        Insert: {
          capability: string;
          enabled?: boolean;
          user_id: string;
        };
        Update: {
          capability?: string;
          enabled?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capability_flag_user_id_user_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_identity: {
        Row: {
          channel: string;
          channel_user_id: string;
          created_at: string;
          display_name: string | null;
          id: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          channel: string;
          channel_user_id: string;
          created_at: string;
          display_name?: string | null;
          id: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          channel?: string;
          channel_user_id?: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "channel_identity_user_id_user_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "channel_identity_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_link_code: {
        Row: {
          channel: string;
          code: string;
          created_at: string;
          expires_at: string;
          id: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          channel: string;
          code: string;
          created_at: string;
          expires_at: string;
          id: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          channel?: string;
          code?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      connection_alias: {
        Row: {
          alias: string;
          app_key: string;
          connection_id: number;
          created_at: string;
          user_id: string;
        };
        Insert: {
          alias: string;
          app_key: string;
          connection_id: number;
          created_at: string;
          user_id: string;
        };
        Update: {
          alias?: string;
          app_key?: string;
          connection_id?: number;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connection_alias_user_id_user_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          mastra_thread_id: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
          visibility: string;
          workspace_id: string | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at: string;
          id: string;
          mastra_thread_id?: string | null;
          title?: string | null;
          updated_at: string;
          user_id: string;
          visibility?: string;
          workspace_id?: string | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          mastra_thread_id?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_user_id_user_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_share: {
        Row: {
          conversation_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          share_token: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          conversation_id: string;
          created_at: string;
          expires_at?: string | null;
          id: string;
          share_token: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          share_token?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_share_conversation_id_fk";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversation";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_share_workspace_id_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      dashboard_share: {
        Row: {
          artifact_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          share_token: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          artifact_id: string;
          created_at: string;
          expires_at?: string | null;
          id: string;
          share_token: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          artifact_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          share_token?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dashboard_share_workspace_id_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      document_share: {
        Row: {
          created_at: string;
          doc_path: string;
          expires_at: string | null;
          id: string;
          share_token: string;
          title: string | null;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at: string;
          doc_path: string;
          expires_at?: string | null;
          id: string;
          share_token: string;
          title?: string | null;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          doc_path?: string;
          expires_at?: string | null;
          id?: string;
          share_token?: string;
          title?: string | null;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_share_workspace_id_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mastra_agent_versions: {
        Row: {
          agentId: string;
          agents: Json | null;
          browser: Json | null;
          changedFields: Json | null;
          changeMessage: string | null;
          createdAt: string;
          createdAtZ: string | null;
          defaultOptions: Json | null;
          description: string | null;
          id: string;
          inputProcessors: Json | null;
          instructions: string;
          integrationTools: Json | null;
          mcpClients: Json | null;
          memory: Json | null;
          model: Json;
          name: string;
          outputProcessors: Json | null;
          requestContextSchema: Json | null;
          scorers: Json | null;
          skills: Json | null;
          skillsFormat: string | null;
          toolProviders: Json | null;
          tools: Json | null;
          versionNumber: number;
          workflows: Json | null;
          workspace: Json | null;
        };
        Insert: {
          agentId: string;
          agents?: Json | null;
          browser?: Json | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          defaultOptions?: Json | null;
          description?: string | null;
          id: string;
          inputProcessors?: Json | null;
          instructions: string;
          integrationTools?: Json | null;
          mcpClients?: Json | null;
          memory?: Json | null;
          model: Json;
          name: string;
          outputProcessors?: Json | null;
          requestContextSchema?: Json | null;
          scorers?: Json | null;
          skills?: Json | null;
          skillsFormat?: string | null;
          toolProviders?: Json | null;
          tools?: Json | null;
          versionNumber: number;
          workflows?: Json | null;
          workspace?: Json | null;
        };
        Update: {
          agentId?: string;
          agents?: Json | null;
          browser?: Json | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          defaultOptions?: Json | null;
          description?: string | null;
          id?: string;
          inputProcessors?: Json | null;
          instructions?: string;
          integrationTools?: Json | null;
          mcpClients?: Json | null;
          memory?: Json | null;
          model?: Json;
          name?: string;
          outputProcessors?: Json | null;
          requestContextSchema?: Json | null;
          scorers?: Json | null;
          skills?: Json | null;
          skillsFormat?: string | null;
          toolProviders?: Json | null;
          tools?: Json | null;
          versionNumber?: number;
          workflows?: Json | null;
          workspace?: Json | null;
        };
        Relationships: [];
      };
      mastra_agents: {
        Row: {
          activeVersionId: string | null;
          authorId: string | null;
          createdAt: string;
          createdAtZ: string | null;
          favoriteCount: number | null;
          id: string;
          metadata: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
          visibility: string | null;
        };
        Insert: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          favoriteCount?: number | null;
          id: string;
          metadata?: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
          visibility?: string | null;
        };
        Update: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          favoriteCount?: number | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
          visibility?: string | null;
        };
        Relationships: [];
      };
      mastra_ai_spans: {
        Row: {
          attributes: Json | null;
          createdAt: string;
          createdAtZ: string | null;
          endedAt: string | null;
          endedAtZ: string | null;
          entityId: string | null;
          entityName: string | null;
          entityType: string | null;
          entityVersionId: string | null;
          environment: string | null;
          error: Json | null;
          experimentId: string | null;
          input: Json | null;
          isEvent: boolean;
          links: Json | null;
          metadata: Json | null;
          name: string;
          organizationId: string | null;
          output: Json | null;
          parentEntityId: string | null;
          parentEntityName: string | null;
          parentEntityType: string | null;
          parentEntityVersionId: string | null;
          parentSpanId: string | null;
          requestContext: Json | null;
          requestId: string | null;
          resourceId: string | null;
          rootEntityId: string | null;
          rootEntityName: string | null;
          rootEntityType: string | null;
          rootEntityVersionId: string | null;
          runId: string | null;
          scope: Json | null;
          serviceName: string | null;
          sessionId: string | null;
          source: string | null;
          spanId: string;
          spanType: string;
          startedAt: string;
          startedAtZ: string | null;
          tags: Json | null;
          threadId: string | null;
          traceId: string;
          updatedAt: string | null;
          updatedAtZ: string | null;
          userId: string | null;
        };
        Insert: {
          attributes?: Json | null;
          createdAt: string;
          createdAtZ?: string | null;
          endedAt?: string | null;
          endedAtZ?: string | null;
          entityId?: string | null;
          entityName?: string | null;
          entityType?: string | null;
          entityVersionId?: string | null;
          environment?: string | null;
          error?: Json | null;
          experimentId?: string | null;
          input?: Json | null;
          isEvent: boolean;
          links?: Json | null;
          metadata?: Json | null;
          name: string;
          organizationId?: string | null;
          output?: Json | null;
          parentEntityId?: string | null;
          parentEntityName?: string | null;
          parentEntityType?: string | null;
          parentEntityVersionId?: string | null;
          parentSpanId?: string | null;
          requestContext?: Json | null;
          requestId?: string | null;
          resourceId?: string | null;
          rootEntityId?: string | null;
          rootEntityName?: string | null;
          rootEntityType?: string | null;
          rootEntityVersionId?: string | null;
          runId?: string | null;
          scope?: Json | null;
          serviceName?: string | null;
          sessionId?: string | null;
          source?: string | null;
          spanId: string;
          spanType: string;
          startedAt: string;
          startedAtZ?: string | null;
          tags?: Json | null;
          threadId?: string | null;
          traceId: string;
          updatedAt?: string | null;
          updatedAtZ?: string | null;
          userId?: string | null;
        };
        Update: {
          attributes?: Json | null;
          createdAt?: string;
          createdAtZ?: string | null;
          endedAt?: string | null;
          endedAtZ?: string | null;
          entityId?: string | null;
          entityName?: string | null;
          entityType?: string | null;
          entityVersionId?: string | null;
          environment?: string | null;
          error?: Json | null;
          experimentId?: string | null;
          input?: Json | null;
          isEvent?: boolean;
          links?: Json | null;
          metadata?: Json | null;
          name?: string;
          organizationId?: string | null;
          output?: Json | null;
          parentEntityId?: string | null;
          parentEntityName?: string | null;
          parentEntityType?: string | null;
          parentEntityVersionId?: string | null;
          parentSpanId?: string | null;
          requestContext?: Json | null;
          requestId?: string | null;
          resourceId?: string | null;
          rootEntityId?: string | null;
          rootEntityName?: string | null;
          rootEntityType?: string | null;
          rootEntityVersionId?: string | null;
          runId?: string | null;
          scope?: Json | null;
          serviceName?: string | null;
          sessionId?: string | null;
          source?: string | null;
          spanId?: string;
          spanType?: string;
          startedAt?: string;
          startedAtZ?: string | null;
          tags?: Json | null;
          threadId?: string | null;
          traceId?: string;
          updatedAt?: string | null;
          updatedAtZ?: string | null;
          userId?: string | null;
        };
        Relationships: [];
      };
      mastra_background_tasks: {
        Row: {
          agent_id: string;
          args: Json;
          completedAt: string | null;
          completedAtZ: string | null;
          createdAt: string;
          createdAtZ: string | null;
          error: Json | null;
          id: string;
          max_retries: number;
          resource_id: string | null;
          result: Json | null;
          retry_count: number;
          run_id: string;
          startedAt: string | null;
          startedAtZ: string | null;
          status: string;
          suspend_payload: Json | null;
          suspendedAt: string | null;
          suspendedAtZ: string | null;
          thread_id: string | null;
          timeout_ms: number;
          tool_call_id: string;
          tool_name: string;
        };
        Insert: {
          agent_id: string;
          args: Json;
          completedAt?: string | null;
          completedAtZ?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          error?: Json | null;
          id: string;
          max_retries: number;
          resource_id?: string | null;
          result?: Json | null;
          retry_count: number;
          run_id: string;
          startedAt?: string | null;
          startedAtZ?: string | null;
          status: string;
          suspend_payload?: Json | null;
          suspendedAt?: string | null;
          suspendedAtZ?: string | null;
          thread_id?: string | null;
          timeout_ms: number;
          tool_call_id: string;
          tool_name: string;
        };
        Update: {
          agent_id?: string;
          args?: Json;
          completedAt?: string | null;
          completedAtZ?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          error?: Json | null;
          id?: string;
          max_retries?: number;
          resource_id?: string | null;
          result?: Json | null;
          retry_count?: number;
          run_id?: string;
          startedAt?: string | null;
          startedAtZ?: string | null;
          status?: string;
          suspend_payload?: Json | null;
          suspendedAt?: string | null;
          suspendedAtZ?: string | null;
          thread_id?: string | null;
          timeout_ms?: number;
          tool_call_id?: string;
          tool_name?: string;
        };
        Relationships: [];
      };
      mastra_channel_config: {
        Row: {
          data: Json;
          platform: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          data: Json;
          platform: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          data?: Json;
          platform?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_channel_installations: {
        Row: {
          agentId: string;
          configHash: string | null;
          createdAt: string;
          createdAtZ: string | null;
          data: Json;
          error: string | null;
          id: string;
          platform: string;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
          webhookId: string | null;
        };
        Insert: {
          agentId: string;
          configHash?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          data: Json;
          error?: string | null;
          id: string;
          platform: string;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
          webhookId?: string | null;
        };
        Update: {
          agentId?: string;
          configHash?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          data?: Json;
          error?: string | null;
          id?: string;
          platform?: string;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
          webhookId?: string | null;
        };
        Relationships: [];
      };
      mastra_dataset_items: {
        Row: {
          createdAt: string;
          createdAtZ: string | null;
          datasetId: string;
          datasetVersion: number;
          expectedTrajectory: Json | null;
          groundTruth: Json | null;
          id: string;
          input: Json;
          isDeleted: boolean;
          metadata: Json | null;
          requestContext: Json | null;
          source: Json | null;
          updatedAt: string;
          updatedAtZ: string | null;
          validTo: number | null;
        };
        Insert: {
          createdAt: string;
          createdAtZ?: string | null;
          datasetId: string;
          datasetVersion: number;
          expectedTrajectory?: Json | null;
          groundTruth?: Json | null;
          id: string;
          input: Json;
          isDeleted: boolean;
          metadata?: Json | null;
          requestContext?: Json | null;
          source?: Json | null;
          updatedAt: string;
          updatedAtZ?: string | null;
          validTo?: number | null;
        };
        Update: {
          createdAt?: string;
          createdAtZ?: string | null;
          datasetId?: string;
          datasetVersion?: number;
          expectedTrajectory?: Json | null;
          groundTruth?: Json | null;
          id?: string;
          input?: Json;
          isDeleted?: boolean;
          metadata?: Json | null;
          requestContext?: Json | null;
          source?: Json | null;
          updatedAt?: string;
          updatedAtZ?: string | null;
          validTo?: number | null;
        };
        Relationships: [];
      };
      mastra_dataset_versions: {
        Row: {
          createdAt: string;
          createdAtZ: string | null;
          datasetId: string;
          id: string;
          version: number;
        };
        Insert: {
          createdAt: string;
          createdAtZ?: string | null;
          datasetId: string;
          id: string;
          version: number;
        };
        Update: {
          createdAt?: string;
          createdAtZ?: string | null;
          datasetId?: string;
          id?: string;
          version?: number;
        };
        Relationships: [];
      };
      mastra_datasets: {
        Row: {
          createdAt: string;
          createdAtZ: string | null;
          description: string | null;
          groundTruthSchema: Json | null;
          id: string;
          inputSchema: Json | null;
          metadata: Json | null;
          name: string;
          requestContextSchema: Json | null;
          scorerIds: Json | null;
          tags: Json | null;
          targetIds: Json | null;
          targetType: string | null;
          updatedAt: string;
          updatedAtZ: string | null;
          version: number;
        };
        Insert: {
          createdAt: string;
          createdAtZ?: string | null;
          description?: string | null;
          groundTruthSchema?: Json | null;
          id: string;
          inputSchema?: Json | null;
          metadata?: Json | null;
          name: string;
          requestContextSchema?: Json | null;
          scorerIds?: Json | null;
          tags?: Json | null;
          targetIds?: Json | null;
          targetType?: string | null;
          updatedAt: string;
          updatedAtZ?: string | null;
          version: number;
        };
        Update: {
          createdAt?: string;
          createdAtZ?: string | null;
          description?: string | null;
          groundTruthSchema?: Json | null;
          id?: string;
          inputSchema?: Json | null;
          metadata?: Json | null;
          name?: string;
          requestContextSchema?: Json | null;
          scorerIds?: Json | null;
          tags?: Json | null;
          targetIds?: Json | null;
          targetType?: string | null;
          updatedAt?: string;
          updatedAtZ?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      mastra_experiment_results: {
        Row: {
          completedAt: string;
          completedAtZ: string | null;
          createdAt: string;
          createdAtZ: string | null;
          error: Json | null;
          experimentId: string;
          groundTruth: Json | null;
          id: string;
          input: Json;
          itemDatasetVersion: number | null;
          itemId: string;
          output: Json | null;
          retryCount: number;
          startedAt: string;
          startedAtZ: string | null;
          status: string | null;
          tags: Json | null;
          traceId: string | null;
        };
        Insert: {
          completedAt: string;
          completedAtZ?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          error?: Json | null;
          experimentId: string;
          groundTruth?: Json | null;
          id: string;
          input: Json;
          itemDatasetVersion?: number | null;
          itemId: string;
          output?: Json | null;
          retryCount: number;
          startedAt: string;
          startedAtZ?: string | null;
          status?: string | null;
          tags?: Json | null;
          traceId?: string | null;
        };
        Update: {
          completedAt?: string;
          completedAtZ?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          error?: Json | null;
          experimentId?: string;
          groundTruth?: Json | null;
          id?: string;
          input?: Json;
          itemDatasetVersion?: number | null;
          itemId?: string;
          output?: Json | null;
          retryCount?: number;
          startedAt?: string;
          startedAtZ?: string | null;
          status?: string | null;
          tags?: Json | null;
          traceId?: string | null;
        };
        Relationships: [];
      };
      mastra_experiments: {
        Row: {
          agentVersion: string | null;
          completedAt: string | null;
          completedAtZ: string | null;
          createdAt: string;
          createdAtZ: string | null;
          datasetId: string | null;
          datasetVersion: number | null;
          description: string | null;
          failedCount: number;
          id: string;
          metadata: Json | null;
          name: string | null;
          skippedCount: number;
          startedAt: string | null;
          startedAtZ: string | null;
          status: string;
          succeededCount: number;
          targetId: string;
          targetType: string;
          totalItems: number;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          agentVersion?: string | null;
          completedAt?: string | null;
          completedAtZ?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          datasetId?: string | null;
          datasetVersion?: number | null;
          description?: string | null;
          failedCount: number;
          id: string;
          metadata?: Json | null;
          name?: string | null;
          skippedCount: number;
          startedAt?: string | null;
          startedAtZ?: string | null;
          status: string;
          succeededCount: number;
          targetId: string;
          targetType: string;
          totalItems: number;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          agentVersion?: string | null;
          completedAt?: string | null;
          completedAtZ?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          datasetId?: string | null;
          datasetVersion?: number | null;
          description?: string | null;
          failedCount?: number;
          id?: string;
          metadata?: Json | null;
          name?: string | null;
          skippedCount?: number;
          startedAt?: string | null;
          startedAtZ?: string | null;
          status?: string;
          succeededCount?: number;
          targetId?: string;
          targetType?: string;
          totalItems?: number;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_favorites: {
        Row: {
          createdAt: string;
          createdAtZ: string | null;
          entityId: string;
          entityType: string;
          userId: string;
        };
        Insert: {
          createdAt: string;
          createdAtZ?: string | null;
          entityId: string;
          entityType: string;
          userId: string;
        };
        Update: {
          createdAt?: string;
          createdAtZ?: string | null;
          entityId?: string;
          entityType?: string;
          userId?: string;
        };
        Relationships: [];
      };
      mastra_mcp_client_versions: {
        Row: {
          changedFields: Json | null;
          changeMessage: string | null;
          createdAt: string;
          createdAtZ: string | null;
          description: string | null;
          id: string;
          mcpClientId: string;
          name: string;
          servers: Json;
          versionNumber: number;
        };
        Insert: {
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          description?: string | null;
          id: string;
          mcpClientId: string;
          name: string;
          servers: Json;
          versionNumber: number;
        };
        Update: {
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          description?: string | null;
          id?: string;
          mcpClientId?: string;
          name?: string;
          servers?: Json;
          versionNumber?: number;
        };
        Relationships: [];
      };
      mastra_mcp_clients: {
        Row: {
          activeVersionId: string | null;
          authorId: string | null;
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          metadata?: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_mcp_server_versions: {
        Row: {
          agents: Json | null;
          changedFields: Json | null;
          changeMessage: string | null;
          createdAt: string;
          createdAtZ: string | null;
          description: string | null;
          id: string;
          instructions: string | null;
          isLatest: boolean | null;
          mcpServerId: string;
          name: string;
          packageCanonical: string | null;
          releaseDate: string | null;
          repository: Json | null;
          tools: Json | null;
          version: string;
          versionNumber: number;
          workflows: Json | null;
        };
        Insert: {
          agents?: Json | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          description?: string | null;
          id: string;
          instructions?: string | null;
          isLatest?: boolean | null;
          mcpServerId: string;
          name: string;
          packageCanonical?: string | null;
          releaseDate?: string | null;
          repository?: Json | null;
          tools?: Json | null;
          version: string;
          versionNumber: number;
          workflows?: Json | null;
        };
        Update: {
          agents?: Json | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          description?: string | null;
          id?: string;
          instructions?: string | null;
          isLatest?: boolean | null;
          mcpServerId?: string;
          name?: string;
          packageCanonical?: string | null;
          releaseDate?: string | null;
          repository?: Json | null;
          tools?: Json | null;
          version?: string;
          versionNumber?: number;
          workflows?: Json | null;
        };
        Relationships: [];
      };
      mastra_mcp_servers: {
        Row: {
          activeVersionId: string | null;
          authorId: string | null;
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          metadata?: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_messages: {
        Row: {
          content: string;
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          resourceId: string | null;
          role: string;
          thread_id: string;
          type: string;
        };
        Insert: {
          content: string;
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          resourceId?: string | null;
          role: string;
          thread_id: string;
          type: string;
        };
        Update: {
          content?: string;
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          resourceId?: string | null;
          role?: string;
          thread_id?: string;
          type?: string;
        };
        Relationships: [];
      };
      mastra_notifications: {
        Row: {
          agentId: string | null;
          archivedAt: string | null;
          archivedAtZ: string | null;
          attributes: Json | null;
          coalescedCount: number;
          coalesceKey: string | null;
          createdAt: string;
          createdAtZ: string | null;
          dedupeKey: string | null;
          deliverAt: string | null;
          deliverAtZ: string | null;
          deliveredAt: string | null;
          deliveredAtZ: string | null;
          deliveredSignalId: string | null;
          deliveryAttempts: number;
          deliveryReason: string | null;
          discardedAt: string | null;
          discardedAtZ: string | null;
          dismissedAt: string | null;
          dismissedAtZ: string | null;
          id: string;
          kind: string;
          lastDeliveryAttemptAt: string | null;
          lastDeliveryAttemptAtZ: string | null;
          lastDeliveryError: string | null;
          metadata: Json | null;
          payload: Json | null;
          priority: string;
          resourceId: string | null;
          seenAt: string | null;
          seenAtZ: string | null;
          source: string;
          sourceId: string | null;
          status: string;
          summary: string;
          summaryAt: string | null;
          summaryAtZ: string | null;
          summarySignalId: string | null;
          threadId: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          agentId?: string | null;
          archivedAt?: string | null;
          archivedAtZ?: string | null;
          attributes?: Json | null;
          coalescedCount: number;
          coalesceKey?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          dedupeKey?: string | null;
          deliverAt?: string | null;
          deliverAtZ?: string | null;
          deliveredAt?: string | null;
          deliveredAtZ?: string | null;
          deliveredSignalId?: string | null;
          deliveryAttempts: number;
          deliveryReason?: string | null;
          discardedAt?: string | null;
          discardedAtZ?: string | null;
          dismissedAt?: string | null;
          dismissedAtZ?: string | null;
          id: string;
          kind: string;
          lastDeliveryAttemptAt?: string | null;
          lastDeliveryAttemptAtZ?: string | null;
          lastDeliveryError?: string | null;
          metadata?: Json | null;
          payload?: Json | null;
          priority: string;
          resourceId?: string | null;
          seenAt?: string | null;
          seenAtZ?: string | null;
          source: string;
          sourceId?: string | null;
          status: string;
          summary: string;
          summaryAt?: string | null;
          summaryAtZ?: string | null;
          summarySignalId?: string | null;
          threadId: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          agentId?: string | null;
          archivedAt?: string | null;
          archivedAtZ?: string | null;
          attributes?: Json | null;
          coalescedCount?: number;
          coalesceKey?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          dedupeKey?: string | null;
          deliverAt?: string | null;
          deliverAtZ?: string | null;
          deliveredAt?: string | null;
          deliveredAtZ?: string | null;
          deliveredSignalId?: string | null;
          deliveryAttempts?: number;
          deliveryReason?: string | null;
          discardedAt?: string | null;
          discardedAtZ?: string | null;
          dismissedAt?: string | null;
          dismissedAtZ?: string | null;
          id?: string;
          kind?: string;
          lastDeliveryAttemptAt?: string | null;
          lastDeliveryAttemptAtZ?: string | null;
          lastDeliveryError?: string | null;
          metadata?: Json | null;
          payload?: Json | null;
          priority?: string;
          resourceId?: string | null;
          seenAt?: string | null;
          seenAtZ?: string | null;
          source?: string;
          sourceId?: string | null;
          status?: string;
          summary?: string;
          summaryAt?: string | null;
          summaryAtZ?: string | null;
          summarySignalId?: string | null;
          threadId?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_observational_memory: {
        Row: {
          activeObservations: string;
          activeObservationsPendingUpdate: string | null;
          bufferedMessageIds: Json | null;
          bufferedObservationChunks: Json | null;
          bufferedObservations: string | null;
          bufferedObservationTokens: number | null;
          bufferedReflection: string | null;
          bufferedReflectionInputTokens: number | null;
          bufferedReflectionTokens: number | null;
          config: string;
          createdAt: string;
          createdAtZ: string | null;
          generationCount: number;
          id: string;
          isBufferingObservation: boolean;
          isBufferingReflection: boolean;
          isObserving: boolean;
          isReflecting: boolean;
          lastBufferedAtTime: string | null;
          lastBufferedAtTimeZ: string | null;
          lastBufferedAtTokens: number;
          lastObservedAt: string | null;
          lastObservedAtZ: string | null;
          lastReflectionAt: string | null;
          lastReflectionAtZ: string | null;
          lookupKey: string;
          metadata: Json | null;
          observationTokenCount: number;
          observedMessageIds: Json | null;
          observedTimezone: string | null;
          originType: string;
          pendingMessageTokens: number;
          reflectedObservationLineCount: number | null;
          resourceId: string | null;
          scope: string;
          threadId: string | null;
          totalTokensObserved: number;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          activeObservations: string;
          activeObservationsPendingUpdate?: string | null;
          bufferedMessageIds?: Json | null;
          bufferedObservationChunks?: Json | null;
          bufferedObservations?: string | null;
          bufferedObservationTokens?: number | null;
          bufferedReflection?: string | null;
          bufferedReflectionInputTokens?: number | null;
          bufferedReflectionTokens?: number | null;
          config: string;
          createdAt: string;
          createdAtZ?: string | null;
          generationCount: number;
          id: string;
          isBufferingObservation: boolean;
          isBufferingReflection: boolean;
          isObserving: boolean;
          isReflecting: boolean;
          lastBufferedAtTime?: string | null;
          lastBufferedAtTimeZ?: string | null;
          lastBufferedAtTokens: number;
          lastObservedAt?: string | null;
          lastObservedAtZ?: string | null;
          lastReflectionAt?: string | null;
          lastReflectionAtZ?: string | null;
          lookupKey: string;
          metadata?: Json | null;
          observationTokenCount: number;
          observedMessageIds?: Json | null;
          observedTimezone?: string | null;
          originType: string;
          pendingMessageTokens: number;
          reflectedObservationLineCount?: number | null;
          resourceId?: string | null;
          scope: string;
          threadId?: string | null;
          totalTokensObserved: number;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          activeObservations?: string;
          activeObservationsPendingUpdate?: string | null;
          bufferedMessageIds?: Json | null;
          bufferedObservationChunks?: Json | null;
          bufferedObservations?: string | null;
          bufferedObservationTokens?: number | null;
          bufferedReflection?: string | null;
          bufferedReflectionInputTokens?: number | null;
          bufferedReflectionTokens?: number | null;
          config?: string;
          createdAt?: string;
          createdAtZ?: string | null;
          generationCount?: number;
          id?: string;
          isBufferingObservation?: boolean;
          isBufferingReflection?: boolean;
          isObserving?: boolean;
          isReflecting?: boolean;
          lastBufferedAtTime?: string | null;
          lastBufferedAtTimeZ?: string | null;
          lastBufferedAtTokens?: number;
          lastObservedAt?: string | null;
          lastObservedAtZ?: string | null;
          lastReflectionAt?: string | null;
          lastReflectionAtZ?: string | null;
          lookupKey?: string;
          metadata?: Json | null;
          observationTokenCount?: number;
          observedMessageIds?: Json | null;
          observedTimezone?: string | null;
          originType?: string;
          pendingMessageTokens?: number;
          reflectedObservationLineCount?: number | null;
          resourceId?: string | null;
          scope?: string;
          threadId?: string | null;
          totalTokensObserved?: number;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_prompt_block_versions: {
        Row: {
          blockId: string;
          changedFields: Json | null;
          changeMessage: string | null;
          content: string;
          createdAt: string;
          createdAtZ: string | null;
          description: string | null;
          id: string;
          name: string;
          requestContextSchema: Json | null;
          rules: Json | null;
          versionNumber: number;
        };
        Insert: {
          blockId: string;
          changedFields?: Json | null;
          changeMessage?: string | null;
          content: string;
          createdAt: string;
          createdAtZ?: string | null;
          description?: string | null;
          id: string;
          name: string;
          requestContextSchema?: Json | null;
          rules?: Json | null;
          versionNumber: number;
        };
        Update: {
          blockId?: string;
          changedFields?: Json | null;
          changeMessage?: string | null;
          content?: string;
          createdAt?: string;
          createdAtZ?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          requestContextSchema?: Json | null;
          rules?: Json | null;
          versionNumber?: number;
        };
        Relationships: [];
      };
      mastra_prompt_blocks: {
        Row: {
          activeVersionId: string | null;
          authorId: string | null;
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          metadata?: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_resources: {
        Row: {
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          metadata: Json | null;
          updatedAt: string;
          updatedAtZ: string | null;
          workingMemory: string | null;
        };
        Insert: {
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          metadata?: Json | null;
          updatedAt: string;
          updatedAtZ?: string | null;
          workingMemory?: string | null;
        };
        Update: {
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          metadata?: Json | null;
          updatedAt?: string;
          updatedAtZ?: string | null;
          workingMemory?: string | null;
        };
        Relationships: [];
      };
      mastra_schedule_triggers: {
        Row: {
          actual_fire_at: number;
          error: string | null;
          id: string;
          metadata: Json | null;
          outcome: string;
          parent_trigger_id: string | null;
          run_id: string | null;
          schedule_id: string;
          scheduled_fire_at: number;
          trigger_kind: string;
        };
        Insert: {
          actual_fire_at: number;
          error?: string | null;
          id: string;
          metadata?: Json | null;
          outcome: string;
          parent_trigger_id?: string | null;
          run_id?: string | null;
          schedule_id: string;
          scheduled_fire_at: number;
          trigger_kind: string;
        };
        Update: {
          actual_fire_at?: number;
          error?: string | null;
          id?: string;
          metadata?: Json | null;
          outcome?: string;
          parent_trigger_id?: string | null;
          run_id?: string | null;
          schedule_id?: string;
          scheduled_fire_at?: number;
          trigger_kind?: string;
        };
        Relationships: [];
      };
      mastra_schedules: {
        Row: {
          created_at: number;
          cron: string;
          id: string;
          last_fire_at: number | null;
          last_run_id: string | null;
          metadata: Json | null;
          next_fire_at: number;
          owner_id: string | null;
          owner_type: string | null;
          status: string;
          target: Json;
          timezone: string | null;
          updated_at: number;
        };
        Insert: {
          created_at: number;
          cron: string;
          id: string;
          last_fire_at?: number | null;
          last_run_id?: string | null;
          metadata?: Json | null;
          next_fire_at: number;
          owner_id?: string | null;
          owner_type?: string | null;
          status: string;
          target: Json;
          timezone?: string | null;
          updated_at: number;
        };
        Update: {
          created_at?: number;
          cron?: string;
          id?: string;
          last_fire_at?: number | null;
          last_run_id?: string | null;
          metadata?: Json | null;
          next_fire_at?: number;
          owner_id?: string | null;
          owner_type?: string | null;
          status?: string;
          target?: Json;
          timezone?: string | null;
          updated_at?: number;
        };
        Relationships: [];
      };
      mastra_scorer_definition_versions: {
        Row: {
          changedFields: Json | null;
          changeMessage: string | null;
          createdAt: string;
          createdAtZ: string | null;
          defaultSampling: Json | null;
          description: string | null;
          id: string;
          instructions: string | null;
          model: Json | null;
          name: string;
          presetConfig: Json | null;
          scoreRange: Json | null;
          scorerDefinitionId: string;
          type: string;
          versionNumber: number;
        };
        Insert: {
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          defaultSampling?: Json | null;
          description?: string | null;
          id: string;
          instructions?: string | null;
          model?: Json | null;
          name: string;
          presetConfig?: Json | null;
          scoreRange?: Json | null;
          scorerDefinitionId: string;
          type: string;
          versionNumber: number;
        };
        Update: {
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          defaultSampling?: Json | null;
          description?: string | null;
          id?: string;
          instructions?: string | null;
          model?: Json | null;
          name?: string;
          presetConfig?: Json | null;
          scoreRange?: Json | null;
          scorerDefinitionId?: string;
          type?: string;
          versionNumber?: number;
        };
        Relationships: [];
      };
      mastra_scorer_definitions: {
        Row: {
          activeVersionId: string | null;
          authorId: string | null;
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          metadata?: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_scorers: {
        Row: {
          additionalContext: Json | null;
          analyzePrompt: string | null;
          analyzeStepResult: Json | null;
          createdAt: string;
          createdAtZ: string | null;
          entity: Json | null;
          entityId: string | null;
          entityType: string | null;
          extractPrompt: string | null;
          extractStepResult: Json | null;
          generateReasonPrompt: string | null;
          generateScorePrompt: string | null;
          id: string;
          input: Json;
          metadata: Json | null;
          output: Json;
          preprocessPrompt: string | null;
          preprocessStepResult: Json | null;
          reason: string | null;
          reasonPrompt: string | null;
          requestContext: Json | null;
          resourceId: string | null;
          runId: string;
          score: number;
          scorer: Json;
          scorerId: string;
          source: string;
          spanId: string | null;
          threadId: string | null;
          traceId: string | null;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          additionalContext?: Json | null;
          analyzePrompt?: string | null;
          analyzeStepResult?: Json | null;
          createdAt: string;
          createdAtZ?: string | null;
          entity?: Json | null;
          entityId?: string | null;
          entityType?: string | null;
          extractPrompt?: string | null;
          extractStepResult?: Json | null;
          generateReasonPrompt?: string | null;
          generateScorePrompt?: string | null;
          id: string;
          input: Json;
          metadata?: Json | null;
          output: Json;
          preprocessPrompt?: string | null;
          preprocessStepResult?: Json | null;
          reason?: string | null;
          reasonPrompt?: string | null;
          requestContext?: Json | null;
          resourceId?: string | null;
          runId: string;
          score: number;
          scorer: Json;
          scorerId: string;
          source: string;
          spanId?: string | null;
          threadId?: string | null;
          traceId?: string | null;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          additionalContext?: Json | null;
          analyzePrompt?: string | null;
          analyzeStepResult?: Json | null;
          createdAt?: string;
          createdAtZ?: string | null;
          entity?: Json | null;
          entityId?: string | null;
          entityType?: string | null;
          extractPrompt?: string | null;
          extractStepResult?: Json | null;
          generateReasonPrompt?: string | null;
          generateScorePrompt?: string | null;
          id?: string;
          input?: Json;
          metadata?: Json | null;
          output?: Json;
          preprocessPrompt?: string | null;
          preprocessStepResult?: Json | null;
          reason?: string | null;
          reasonPrompt?: string | null;
          requestContext?: Json | null;
          resourceId?: string | null;
          runId?: string;
          score?: number;
          scorer?: Json;
          scorerId?: string;
          source?: string;
          spanId?: string | null;
          threadId?: string | null;
          traceId?: string | null;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_skill_blobs: {
        Row: {
          content: string;
          createdAt: string;
          createdAtZ: string | null;
          hash: string;
          mimeType: string | null;
          size: number;
        };
        Insert: {
          content: string;
          createdAt: string;
          createdAtZ?: string | null;
          hash: string;
          mimeType?: string | null;
          size: number;
        };
        Update: {
          content?: string;
          createdAt?: string;
          createdAtZ?: string | null;
          hash?: string;
          mimeType?: string | null;
          size?: number;
        };
        Relationships: [];
      };
      mastra_skill_versions: {
        Row: {
          assets: Json | null;
          changedFields: Json | null;
          changeMessage: string | null;
          compatibility: Json | null;
          createdAt: string;
          createdAtZ: string | null;
          description: string;
          files: Json | null;
          id: string;
          instructions: string;
          license: string | null;
          metadata: Json | null;
          name: string;
          references: Json | null;
          scripts: Json | null;
          skillId: string;
          source: Json | null;
          tree: Json | null;
          versionNumber: number;
        };
        Insert: {
          assets?: Json | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          compatibility?: Json | null;
          createdAt: string;
          createdAtZ?: string | null;
          description: string;
          files?: Json | null;
          id: string;
          instructions: string;
          license?: string | null;
          metadata?: Json | null;
          name: string;
          references?: Json | null;
          scripts?: Json | null;
          skillId: string;
          source?: Json | null;
          tree?: Json | null;
          versionNumber: number;
        };
        Update: {
          assets?: Json | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          compatibility?: Json | null;
          createdAt?: string;
          createdAtZ?: string | null;
          description?: string;
          files?: Json | null;
          id?: string;
          instructions?: string;
          license?: string | null;
          metadata?: Json | null;
          name?: string;
          references?: Json | null;
          scripts?: Json | null;
          skillId?: string;
          source?: Json | null;
          tree?: Json | null;
          versionNumber?: number;
        };
        Relationships: [];
      };
      mastra_skills: {
        Row: {
          activeVersionId: string | null;
          authorId: string | null;
          createdAt: string;
          createdAtZ: string | null;
          favoriteCount: number | null;
          id: string;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
          visibility: string | null;
        };
        Insert: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          favoriteCount?: number | null;
          id: string;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
          visibility?: string | null;
        };
        Update: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          favoriteCount?: number | null;
          id?: string;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
          visibility?: string | null;
        };
        Relationships: [];
      };
      mastra_threads: {
        Row: {
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          metadata: Json | null;
          resourceId: string;
          title: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          metadata?: Json | null;
          resourceId: string;
          title: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          metadata?: Json | null;
          resourceId?: string;
          title?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_tool_provider_connections: {
        Row: {
          authorId: string;
          connectionId: string;
          createdAt: string;
          createdAtZ: string | null;
          label: string | null;
          providerId: string;
          scope: string;
          toolkit: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          authorId: string;
          connectionId: string;
          createdAt: string;
          createdAtZ?: string | null;
          label?: string | null;
          providerId: string;
          scope: string;
          toolkit: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          authorId?: string;
          connectionId?: string;
          createdAt?: string;
          createdAtZ?: string | null;
          label?: string | null;
          providerId?: string;
          scope?: string;
          toolkit?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      mastra_workflow_snapshot: {
        Row: {
          createdAt: string;
          createdAtZ: string | null;
          resourceId: string | null;
          run_id: string;
          snapshot: Json;
          updatedAt: string;
          updatedAtZ: string | null;
          workflow_name: string;
        };
        Insert: {
          createdAt: string;
          createdAtZ?: string | null;
          resourceId?: string | null;
          run_id: string;
          snapshot: Json;
          updatedAt: string;
          updatedAtZ?: string | null;
          workflow_name: string;
        };
        Update: {
          createdAt?: string;
          createdAtZ?: string | null;
          resourceId?: string | null;
          run_id?: string;
          snapshot?: Json;
          updatedAt?: string;
          updatedAtZ?: string | null;
          workflow_name?: string;
        };
        Relationships: [];
      };
      mastra_workspace_versions: {
        Row: {
          autoSync: boolean | null;
          changedFields: Json | null;
          changeMessage: string | null;
          createdAt: string;
          createdAtZ: string | null;
          description: string | null;
          filesystem: Json | null;
          id: string;
          mounts: Json | null;
          name: string;
          operationTimeout: number | null;
          sandbox: Json | null;
          search: Json | null;
          skills: Json | null;
          tools: Json | null;
          versionNumber: number;
          workspaceId: string;
        };
        Insert: {
          autoSync?: boolean | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          description?: string | null;
          filesystem?: Json | null;
          id: string;
          mounts?: Json | null;
          name: string;
          operationTimeout?: number | null;
          sandbox?: Json | null;
          search?: Json | null;
          skills?: Json | null;
          tools?: Json | null;
          versionNumber: number;
          workspaceId: string;
        };
        Update: {
          autoSync?: boolean | null;
          changedFields?: Json | null;
          changeMessage?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          description?: string | null;
          filesystem?: Json | null;
          id?: string;
          mounts?: Json | null;
          name?: string;
          operationTimeout?: number | null;
          sandbox?: Json | null;
          search?: Json | null;
          skills?: Json | null;
          tools?: Json | null;
          versionNumber?: number;
          workspaceId?: string;
        };
        Relationships: [];
      };
      mastra_workspaces: {
        Row: {
          activeVersionId: string | null;
          authorId: string | null;
          createdAt: string;
          createdAtZ: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ: string | null;
        };
        Insert: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt: string;
          createdAtZ?: string | null;
          id: string;
          metadata?: Json | null;
          status: string;
          updatedAt: string;
          updatedAtZ?: string | null;
        };
        Update: {
          activeVersionId?: string | null;
          authorId?: string | null;
          createdAt?: string;
          createdAtZ?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          updatedAt?: string;
          updatedAtZ?: string | null;
        };
        Relationships: [];
      };
      memory_messages_384: {
        Row: {
          embedding: string | null;
          id: number;
          metadata: Json | null;
          vector_id: string;
        };
        Insert: {
          embedding?: string | null;
          id?: number;
          metadata?: Json | null;
          vector_id: string;
        };
        Update: {
          embedding?: string | null;
          id?: number;
          metadata?: Json | null;
          vector_id?: string;
        };
        Relationships: [];
      };
      slack_installation: {
        Row: {
          bot_token: string;
          bot_user_id: string | null;
          installed_at: string;
          team_id: string;
          team_name: string | null;
          updated_at: string;
        };
        Insert: {
          bot_token: string;
          bot_user_id?: string | null;
          installed_at?: string;
          team_id: string;
          team_name?: string | null;
          updated_at?: string;
        };
        Update: {
          bot_token?: string;
          bot_user_id?: string | null;
          installed_at?: string;
          team_id?: string;
          team_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      stored_agent: {
        Row: {
          created_at: string;
          current_version_id: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          created_at: string;
          current_version_id?: string | null;
          description?: string | null;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          created_at?: string;
          current_version_id?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stored_agent_current_version_id_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "stored_agent_version";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stored_agent_user_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stored_agent_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      stored_agent_version: {
        Row: {
          agent_id: string;
          created_at: string;
          id: string;
          instructions: string;
          model: string;
          notes: string | null;
          published_at: string | null;
          tools: string;
          version: number;
        };
        Insert: {
          agent_id: string;
          created_at: string;
          id: string;
          instructions: string;
          model: string;
          notes?: string | null;
          published_at?: string | null;
          tools: string;
          version: number;
        };
        Update: {
          agent_id?: string;
          created_at?: string;
          id?: string;
          instructions?: string;
          model?: string;
          notes?: string | null;
          published_at?: string | null;
          tools?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stored_agent_version_agent_id_fk";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "stored_agent";
            referencedColumns: ["id"];
          },
        ];
      };
      user: {
        Row: {
          createdAt: string;
          default_workspace_id: string | null;
          email: string;
          emailVerified: boolean;
          id: string;
          image: string | null;
          name: string;
          updatedAt: string;
        };
        Insert: {
          createdAt: string;
          default_workspace_id?: string | null;
          email: string;
          emailVerified: boolean;
          id: string;
          image?: string | null;
          name: string;
          updatedAt: string;
        };
        Update: {
          createdAt?: string;
          default_workspace_id?: string | null;
          email?: string;
          emailVerified?: boolean;
          id?: string;
          image?: string | null;
          name?: string;
          updatedAt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_default_workspace_id_fkey";
            columns: ["default_workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      user_application_settings: {
        Row: {
          email: string | null;
          id: string;
        };
        Insert: {
          email?: string | null;
          id: string;
        };
        Update: {
          email?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_application_settings_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          is_seen: boolean;
          payload: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          is_seen?: boolean;
          payload?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          is_seen?: boolean;
          payload?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          default_workspace: string | null;
          id: string;
        };
        Insert: {
          default_workspace?: string | null;
          id: string;
        };
        Update: {
          default_workspace?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_default_workspace_fkey";
            columns: ["default_workspace"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_settings_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_admin_settings: {
        Row: {
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_admin_settings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_application_settings: {
        Row: {
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_application_settings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_credits: {
        Row: {
          credits: number;
          id: string;
          workspace_id: string;
        };
        Insert: {
          credits?: number;
          id?: string;
          workspace_id: string;
        };
        Update: {
          credits?: number;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_credits_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_credits_logs: {
        Row: {
          change_type: string;
          changed_at: string;
          id: string;
          new_credits: number | null;
          old_credits: number | null;
          workspace_credits_id: string;
          workspace_id: string;
        };
        Insert: {
          change_type: string;
          changed_at?: string;
          id?: string;
          new_credits?: number | null;
          old_credits?: number | null;
          workspace_credits_id: string;
          workspace_id: string;
        };
        Update: {
          change_type?: string;
          changed_at?: string;
          id?: string;
          new_credits?: number | null;
          old_credits?: number | null;
          workspace_credits_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_credits_logs_workspace_credits_id_fkey";
            columns: ["workspace_credits_id"];
            isOneToOne: false;
            referencedRelation: "workspace_credits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_credits_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          created_at: string;
          id: string;
          invitee_user_email: string;
          invitee_user_id: string | null;
          invitee_user_role: Database["public"]["Enums"]["workspace_member_role_type"];
          inviter_user_id: string;
          status: Database["public"]["Enums"]["workspace_invitation_link_status"];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invitee_user_email: string;
          invitee_user_id?: string | null;
          invitee_user_role?: Database["public"]["Enums"]["workspace_member_role_type"];
          inviter_user_id: string;
          status?: Database["public"]["Enums"]["workspace_invitation_link_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invitee_user_email?: string;
          invitee_user_id?: string | null;
          invitee_user_role?: Database["public"]["Enums"]["workspace_member_role_type"];
          inviter_user_id?: string;
          status?: Database["public"]["Enums"]["workspace_invitation_link_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_invitee_user_id_fkey";
            columns: ["invitee_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invitations_inviter_user_id_fkey";
            columns: ["inviter_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          added_at: string;
          permissions: Json;
          workspace_id: string;
          workspace_member_id: string;
          workspace_member_role: Database["public"]["Enums"]["workspace_member_role_type"];
        };
        Insert: {
          added_at?: string;
          permissions?: Json;
          workspace_id: string;
          workspace_member_id: string;
          workspace_member_role?: Database["public"]["Enums"]["workspace_member_role_type"];
        };
        Update: {
          added_at?: string;
          permissions?: Json;
          workspace_id?: string;
          workspace_member_id?: string;
          workspace_member_role?: Database["public"]["Enums"]["workspace_member_role_type"];
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_member_id_fkey";
            columns: ["workspace_member_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_settings: {
        Row: {
          updated_at: string;
          workspace_id: string;
          zapier_connection_mode: string;
        };
        Insert: {
          updated_at?: string;
          workspace_id: string;
          zapier_connection_mode?: string;
        };
        Update: {
          updated_at?: string;
          workspace_id?: string;
          zapier_connection_mode?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          membership_type: Database["public"]["Enums"]["workspace_membership_type"];
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          membership_type?: Database["public"]["Enums"]["workspace_membership_type"];
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          membership_type?: Database["public"]["Enums"]["workspace_membership_type"];
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      zapier_identity: {
        Row: {
          access_token: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          refresh_token: string;
          scopes: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          access_token: string;
          created_at: string;
          expires_at?: string | null;
          id: string;
          refresh_token: string;
          scopes: string;
          updated_at: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          access_token?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          refresh_token?: string;
          scopes?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "zapier_identity_user_id_user_id_fk";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "user";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "zapier_identity_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      app_admin_get_recent_30_day_signin_count: { Args: never; Returns: number };
      app_admin_get_total_user_count: { Args: never; Returns: number };
      app_admin_get_total_workspace_count: { Args: never; Returns: number };
      app_admin_get_user_id_by_email: {
        Args: { emailarg: string };
        Returns: string;
      };
      app_admin_get_users_created_per_month: {
        Args: never;
        Returns: {
          month: string;
          number_of_users: number;
        }[];
      };
      app_admin_get_workspaces_created_per_month: {
        Args: never;
        Returns: {
          month: string;
          number_of_workspaces: number;
        }[];
      };
      check_if_authenticated_user_owns_email: {
        Args: { email: string };
        Returns: boolean;
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      decrement_workspace_credits: {
        Args: { amount: number; ws_id: string };
        Returns: undefined;
      };
      get_customer_workspace_id: {
        Args: { customer_id: string };
        Returns: string;
      };
      get_workspace_team_member_admins: {
        Args: { ws_id: string };
        Returns: string[];
      };
      get_workspace_team_member_ids: {
        Args: { ws_id: string };
        Returns: string[];
      };
      has_workspace_permission: {
        Args: { permission: string; user_id: string; workspace_id: string };
        Returns: boolean;
      };
      is_application_admin: { Args: { user_id?: string }; Returns: boolean };
      is_workspace_admin: {
        Args: { user_id: string; workspace_id: string };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { user_id: string; workspace_id: string };
        Returns: boolean;
      };
      update_workspace_member_permissions: {
        Args: { member_id: string; new_permissions: Json; workspace_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      pricing_plan_interval: "day" | "week" | "month" | "year";
      subscription_status:
        | "trialing"
        | "active"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "past_due"
        | "unpaid"
        | "paused";
      workspace_invitation_link_status:
        | "pending"
        | "finished_accepted"
        | "finished_declined"
        | "expired";
      workspace_member_role_type: "owner" | "admin" | "member" | "readonly";
      workspace_membership_type: "solo" | "team";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      pricing_plan_interval: ["day", "week", "month", "year"],
      subscription_status: [
        "trialing",
        "active",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "past_due",
        "unpaid",
        "paused",
      ],
      workspace_invitation_link_status: [
        "pending",
        "finished_accepted",
        "finished_declined",
        "expired",
      ],
      workspace_member_role_type: ["owner", "admin", "member", "readonly"],
      workspace_membership_type: ["solo", "team"],
    },
  },
} as const;
