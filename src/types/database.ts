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
      account_actions: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          created_at: string
          id: number
          profile_id: string
          reason: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          id?: never
          profile_id: string
          reason?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          id?: never
          profile_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_actions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      army_ai_jobs: {
        Row: {
          club_id: number
          cost_pence: number
          created_at: string
          error_code: string
          feature: string
          finished_at: string | null
          id: number
          latency_ms: number
          model: string
          profile_id: string
          provider: string
          request_payload: Json
          result: Json | null
          source: Json
          source_signature: string
          started_at: string | null
          status: string
          tokens_cached: number
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          club_id: number
          cost_pence?: number
          created_at?: string
          error_code?: string
          feature: string
          finished_at?: string | null
          id?: never
          latency_ms?: number
          model?: string
          profile_id: string
          provider?: string
          request_payload?: Json
          result?: Json | null
          source?: Json
          source_signature?: string
          started_at?: string | null
          status?: string
          tokens_cached?: number
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          club_id?: number
          cost_pence?: number
          created_at?: string
          error_code?: string
          feature?: string
          finished_at?: string | null
          id?: never
          latency_ms?: number
          model?: string
          profile_id?: string
          provider?: string
          request_payload?: Json
          result?: Json | null
          source?: Json
          source_signature?: string
          started_at?: string | null
          status?: string
          tokens_cached?: number
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "army_ai_jobs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "army_ai_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      army_catalogue_snapshots: {
        Row: {
          catalogue: Json
          catalogue_version: string
          edition_id: string
          note: string
          published_at: string
          published_by: string | null
        }
        Insert: {
          catalogue: Json
          catalogue_version: string
          edition_id: string
          note?: string
          published_at?: string
          published_by?: string | null
        }
        Update: {
          catalogue?: Json
          catalogue_version?: string
          edition_id?: string
          note?: string
          published_at?: string
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "army_catalogue_snapshots_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "army_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "army_catalogue_snapshots_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      army_detachments: {
        Row: {
          dispositions: string[]
          edition_id: string
          faction_id: string
          id: number
          label: string
          position: number
          slug: string
        }
        Insert: {
          dispositions?: string[]
          edition_id: string
          faction_id: string
          id?: never
          label: string
          position?: number
          slug: string
        }
        Update: {
          dispositions?: string[]
          edition_id?: string
          faction_id?: string
          id?: never
          label?: string
          position?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "army_detachments_edition_id_faction_id_fkey"
            columns: ["edition_id", "faction_id"]
            isOneToOne: false
            referencedRelation: "army_factions"
            referencedColumns: ["edition_id", "id"]
          },
        ]
      }
      army_editions: {
        Row: {
          catalogue_version: string
          created_at: string
          id: string
          label: string
          status: string
          system_id: string
          updated_at: string
        }
        Insert: {
          catalogue_version: string
          created_at?: string
          id: string
          label: string
          status?: string
          system_id: string
          updated_at?: string
        }
        Update: {
          catalogue_version?: string
          created_at?: string
          id?: string
          label?: string
          status?: string
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "army_editions_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "army_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      army_factions: {
        Row: {
          edition_id: string
          id: string
          label: string
          position: number
        }
        Insert: {
          edition_id: string
          id: string
          label: string
          position?: number
        }
        Update: {
          edition_id?: string
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "army_factions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "army_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      army_list_versions: {
        Row: {
          catalogue_version: string
          change_summary: string
          created_at: string
          detachment_selections: Json
          edition_id: string
          faction_id: string
          faction_label: string
          id: number
          list_id: number
          list_type: string
          name: string
          points_limit: string
          signature: string
          total_points: number
          units: Json
          version_number: number
        }
        Insert: {
          catalogue_version?: string
          change_summary?: string
          created_at?: string
          detachment_selections?: Json
          edition_id?: string
          faction_id?: string
          faction_label?: string
          id?: never
          list_id: number
          list_type?: string
          name?: string
          points_limit?: string
          signature?: string
          total_points?: number
          units?: Json
          version_number: number
        }
        Update: {
          catalogue_version?: string
          change_summary?: string
          created_at?: string
          detachment_selections?: Json
          edition_id?: string
          faction_id?: string
          faction_label?: string
          id?: never
          list_id?: number
          list_type?: string
          name?: string
          points_limit?: string
          signature?: string
          total_points?: number
          units?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "army_list_versions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "army_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      army_lists: {
        Row: {
          club_id: number
          created_at: string
          current_version_id: number | null
          deleted_at: string | null
          edition_id: string
          faction_id: string
          faction_label: string
          id: number
          list_type: string
          name: string
          points_limit: string
          profile_id: string
          system_id: string
          updated_at: string
        }
        Insert: {
          club_id: number
          created_at?: string
          current_version_id?: number | null
          deleted_at?: string | null
          edition_id?: string
          faction_id?: string
          faction_label?: string
          id?: never
          list_type?: string
          name?: string
          points_limit?: string
          profile_id: string
          system_id?: string
          updated_at?: string
        }
        Update: {
          club_id?: number
          created_at?: string
          current_version_id?: number | null
          deleted_at?: string | null
          edition_id?: string
          faction_id?: string
          faction_label?: string
          id?: never
          list_type?: string
          name?: string
          points_limit?: string
          profile_id?: string
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "army_lists_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "army_lists_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "army_list_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "army_lists_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      army_systems: {
        Row: {
          created_at: string
          id: string
          label: string
          points_options: string[]
        }
        Insert: {
          created_at?: string
          id: string
          label: string
          points_options?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          points_options?: string[]
        }
        Relationships: []
      }
      army_units: {
        Row: {
          base_points: number
          copy_cost_rules: Json
          edition_id: string
          faction_id: string
          id: number
          name: string
          options: Json
          position: number
        }
        Insert: {
          base_points?: number
          copy_cost_rules?: Json
          edition_id: string
          faction_id: string
          id?: never
          name: string
          options?: Json
          position?: number
        }
        Update: {
          base_points?: number
          copy_cost_rules?: Json
          edition_id?: string
          faction_id?: string
          id?: never
          name?: string
          options?: Json
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "army_units_edition_id_faction_id_fkey"
            columns: ["edition_id", "faction_id"]
            isOneToOne: false
            referencedRelation: "army_factions"
            referencedColumns: ["edition_id", "id"]
          },
        ]
      }
      club_announcements: {
        Row: {
          club_id: number
          created_at: string
          id: number
          legacy_id: number | null
          message: string
        }
        Insert: {
          club_id: number
          created_at?: string
          id?: never
          legacy_id?: number | null
          message: string
        }
        Update: {
          club_id?: number
          created_at?: string
          id?: never
          legacy_id?: number | null
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_army_builder_settings: {
        Row: {
          club_id: number
          coaching_daily_limit: number
          edition_id: string | null
          enabled: boolean
          matchup_daily_limit: number
          monthly_ai_cap_pence: number
          scouting_daily_limit: number
          season_daily_limit: number
          updated_at: string
        }
        Insert: {
          club_id: number
          coaching_daily_limit?: number
          edition_id?: string | null
          enabled?: boolean
          matchup_daily_limit?: number
          monthly_ai_cap_pence?: number
          scouting_daily_limit?: number
          season_daily_limit?: number
          updated_at?: string
        }
        Update: {
          club_id?: number
          coaching_daily_limit?: number
          edition_id?: string | null
          enabled?: boolean
          matchup_daily_limit?: number
          monthly_ai_cap_pence?: number
          scouting_daily_limit?: number
          season_daily_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_army_builder_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_army_builder_settings_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "army_editions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          after: Json | null
          before: Json | null
          changed_keys: string[]
          club_id: number
          created_at: string
          entity_id: string
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string
          after?: Json | null
          before?: Json | null
          changed_keys?: string[]
          club_id: number
          created_at?: string
          entity_id?: string
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          after?: Json | null
          before?: Json | null
          changed_keys?: string[]
          club_id?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "club_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_audit_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_badges: {
        Row: {
          active: boolean
          club_id: number
          created_at: string
          created_by: string | null
          description: string
          icon: string
          id: number
          label: string
          tone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          club_id: number
          created_at?: string
          created_by?: string | null
          description?: string
          icon?: string
          id?: never
          label: string
          tone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          club_id?: number
          created_at?: string
          created_by?: string | null
          description?: string
          icon?: string
          id?: never
          label?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_badges_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_badges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_booking_participants: {
        Row: {
          booking_id: number
          club_id: number
          profile_id: string
          role: string
          session_date: string
        }
        Insert: {
          booking_id: number
          club_id: number
          profile_id: string
          role: string
          session_date: string
        }
        Update: {
          booking_id?: number
          club_id?: number
          profile_id?: string
          role?: string
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "club_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_booking_participants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_booking_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_booking_settings: {
        Row: {
          calendar_horizon_days: number
          cancel_cutoff_hours: number
          club_id: number
          enforce_advance_window: boolean
          looking_for_games_enabled: boolean
          price_currency: string
          table_booking_price: number
          updated_at: string
          waitlist_enabled: boolean
        }
        Insert: {
          calendar_horizon_days?: number
          cancel_cutoff_hours?: number
          club_id: number
          enforce_advance_window?: boolean
          looking_for_games_enabled?: boolean
          price_currency?: string
          table_booking_price?: number
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Update: {
          calendar_horizon_days?: number
          cancel_cutoff_hours?: number
          club_id?: number
          enforce_advance_window?: boolean
          looking_for_games_enabled?: boolean
          price_currency?: string
          table_booking_price?: number
          updated_at?: string
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "club_booking_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_booking_waitlist: {
        Row: {
          booking_id: number | null
          club_id: number
          club_session_id: number
          created_at: string
          game_title: string
          id: number
          last_skip_reason: string | null
          last_skipped_at: string | null
          legacy_id: number | null
          notes: string
          opponent_name: string
          opponent_profile_id: string | null
          promoted_at: string | null
          requested_by: string
          session_date: string
          session_day: string
          session_label: string
          session_time: string
          skip_count: number
          status: string
          withdrawn_at: string | null
        }
        Insert: {
          booking_id?: number | null
          club_id: number
          club_session_id: number
          created_at?: string
          game_title: string
          id?: never
          last_skip_reason?: string | null
          last_skipped_at?: string | null
          legacy_id?: number | null
          notes?: string
          opponent_name?: string
          opponent_profile_id?: string | null
          promoted_at?: string | null
          requested_by?: string
          session_date: string
          session_day?: string
          session_label?: string
          session_time?: string
          skip_count?: number
          status?: string
          withdrawn_at?: string | null
        }
        Update: {
          booking_id?: number | null
          club_id?: number
          club_session_id?: number
          created_at?: string
          game_title?: string
          id?: never
          last_skip_reason?: string | null
          last_skipped_at?: string | null
          legacy_id?: number | null
          notes?: string
          opponent_name?: string
          opponent_profile_id?: string | null
          promoted_at?: string | null
          requested_by?: string
          session_date?: string
          session_day?: string
          session_label?: string
          session_time?: string
          skip_count?: number
          status?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_booking_waitlist_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "club_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_booking_waitlist_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_booking_waitlist_club_session_id_fkey"
            columns: ["club_session_id"]
            isOneToOne: false
            referencedRelation: "club_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_booking_waitlist_opponent_profile_id_fkey"
            columns: ["opponent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_booking_waitlist_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_bookings: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          base_price: number
          booked_by: string
          booked_by_army: string
          booked_by_score: number | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          club_id: number
          club_session_id: number
          created_at: string
          game_title: string
          id: number
          legacy_id: number | null
          legacy_session_key: string | null
          loyalty_discount_amount: number
          loyalty_points_spent: number
          membership_tier_key: string | null
          membership_tier_label: string
          notes: string
          opponent_army: string
          opponent_name: string
          opponent_profile_id: string | null
          opponent_score: number | null
          price_currency: string
          result_at: string | null
          result_by: string | null
          result_confirmation: string
          result_deployment: string
          result_mission: string
          result_terrain: string
          session_date: string
          session_day: string
          session_label: string
          session_time: string
          source: string
          status: string
          table_index: number
          tier_discount_amount: number
          tier_discount_percent: number
          total_price: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          base_price?: number
          booked_by?: string
          booked_by_army?: string
          booked_by_score?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          club_id: number
          club_session_id: number
          created_at?: string
          game_title: string
          id?: never
          legacy_id?: number | null
          legacy_session_key?: string | null
          loyalty_discount_amount?: number
          loyalty_points_spent?: number
          membership_tier_key?: string | null
          membership_tier_label?: string
          notes?: string
          opponent_army?: string
          opponent_name?: string
          opponent_profile_id?: string | null
          opponent_score?: number | null
          price_currency?: string
          result_at?: string | null
          result_by?: string | null
          result_confirmation?: string
          result_deployment?: string
          result_mission?: string
          result_terrain?: string
          session_date: string
          session_day?: string
          session_label?: string
          session_time?: string
          source?: string
          status?: string
          table_index?: number
          tier_discount_amount?: number
          tier_discount_percent?: number
          total_price?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          base_price?: number
          booked_by?: string
          booked_by_army?: string
          booked_by_score?: number | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          club_id?: number
          club_session_id?: number
          created_at?: string
          game_title?: string
          id?: never
          legacy_id?: number | null
          legacy_session_key?: string | null
          loyalty_discount_amount?: number
          loyalty_points_spent?: number
          membership_tier_key?: string | null
          membership_tier_label?: string
          notes?: string
          opponent_army?: string
          opponent_name?: string
          opponent_profile_id?: string | null
          opponent_score?: number | null
          price_currency?: string
          result_at?: string | null
          result_by?: string | null
          result_confirmation?: string
          result_deployment?: string
          result_mission?: string
          result_terrain?: string
          session_date?: string
          session_day?: string
          session_label?: string
          session_time?: string
          source?: string
          status?: string
          table_index?: number
          tier_discount_amount?: number
          tier_discount_percent?: number
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_bookings_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_bookings_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_bookings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_bookings_club_session_id_fkey"
            columns: ["club_session_id"]
            isOneToOne: false
            referencedRelation: "club_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_bookings_opponent_profile_id_fkey"
            columns: ["opponent_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_bookings_result_by_fkey"
            columns: ["result_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_claims: {
        Row: {
          claimant_id: string
          club_id: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          evidence: string
          id: number
          message: string
          status: string
          updated_at: string
        }
        Insert: {
          claimant_id?: string
          club_id: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          evidence?: string
          id?: never
          message?: string
          status?: string
          updated_at?: string
        }
        Update: {
          claimant_id?: string
          club_id?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          evidence?: string
          id?: never
          message?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_claims_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_claims_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_claims_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_coaching_bookings: {
        Row: {
          booked_at: string
          cancelled_at: string | null
          cancelled_by: string | null
          id: number
          paid_at: string | null
          payment_status: string
          profile_id: string
          slot_id: number
          status: string
        }
        Insert: {
          booked_at?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          id?: never
          paid_at?: string | null
          payment_status?: string
          profile_id?: string
          slot_id: number
          status?: string
        }
        Update: {
          booked_at?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          id?: never
          paid_at?: string | null
          payment_status?: string
          profile_id?: string
          slot_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_coaching_bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_coaching_bookings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_coaching_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "club_coaching_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      club_coaching_settings: {
        Row: {
          club_id: number
          enabled: boolean
          intro_text: string | null
          policy_text: string | null
        }
        Insert: {
          club_id: number
          enabled?: boolean
          intro_text?: string | null
          policy_text?: string | null
        }
        Update: {
          club_id?: number
          enabled?: boolean
          intro_text?: string | null
          policy_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_coaching_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_coaching_slots: {
        Row: {
          capacity: number
          club_id: number
          coaching_type: string
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          id: number
          price: string | null
          slot_date: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          club_id: number
          coaching_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: never
          price?: string | null
          slot_date: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          club_id?: number
          coaching_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: never
          price?: string | null
          slot_date?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_coaching_slots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_coaching_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_competition_matches: {
        Row: {
          id: number
          player_one: string
          player_one_score: string
          player_two: string
          player_two_score: string
          position: number
          update_id: number
        }
        Insert: {
          id?: never
          player_one?: string
          player_one_score?: string
          player_two?: string
          player_two_score?: string
          position?: number
          update_id: number
        }
        Update: {
          id?: never
          player_one?: string
          player_one_score?: string
          player_two?: string
          player_two_score?: string
          position?: number
          update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_competition_matches_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "club_competition_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      club_competition_standings: {
        Row: {
          competition_id: number
          detachment: string
          disposition: string
          draws: number
          faction: string
          id: number
          losses: number
          member_name: string
          notes: string
          played: number
          points: number
          profile_id: string | null
          rank: number
          record_label: string
          wins: number
        }
        Insert: {
          competition_id: number
          detachment?: string
          disposition?: string
          draws?: number
          faction?: string
          id?: never
          losses?: number
          member_name?: string
          notes?: string
          played?: number
          points?: number
          profile_id?: string | null
          rank?: number
          record_label?: string
          wins?: number
        }
        Update: {
          competition_id?: number
          detachment?: string
          disposition?: string
          draws?: number
          faction?: string
          id?: never
          losses?: number
          member_name?: string
          notes?: string
          played?: number
          points?: number
          profile_id?: string | null
          rank?: number
          record_label?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_competition_standings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "club_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_competition_standings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_competition_updates: {
        Row: {
          competition_id: number
          id: number
          position: number
          posted_on: string | null
          summary: string
          title: string
        }
        Insert: {
          competition_id: number
          id?: never
          position?: number
          posted_on?: string | null
          summary?: string
          title?: string
        }
        Update: {
          competition_id?: number
          id?: never
          position?: number
          posted_on?: string | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_competition_updates_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "club_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_competitions: {
        Row: {
          club_id: number
          created_at: string
          end_date: string | null
          game: string
          id: number
          legacy_id: string
          position: number
          season: string
          start_date: string | null
          status: string
          status_label: string
          summary: string
          title: string
          type: string
          type_label: string
        }
        Insert: {
          club_id: number
          created_at?: string
          end_date?: string | null
          game?: string
          id?: never
          legacy_id?: string
          position?: number
          season?: string
          start_date?: string | null
          status?: string
          status_label?: string
          summary?: string
          title: string
          type?: string
          type_label?: string
        }
        Update: {
          club_id?: number
          created_at?: string
          end_date?: string | null
          game?: string
          id?: never
          legacy_id?: string
          position?: number
          season?: string
          start_date?: string | null
          status?: string
          status_label?: string
          summary?: string
          title?: string
          type?: string
          type_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_competitions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_discussion_categories: {
        Row: {
          club_id: number
          id: number
          label: string
          position: number
        }
        Insert: {
          club_id: number
          id?: never
          label: string
          position?: number
        }
        Update: {
          club_id?: number
          id?: never
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_discussion_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_discussion_poll_votes: {
        Row: {
          id: number
          option_key: string
          post_id: number
          profile_id: string
          voted_at: string
        }
        Insert: {
          id?: never
          option_key: string
          post_id: number
          profile_id?: string
          voted_at?: string
        }
        Update: {
          id?: never
          option_key?: string
          post_id?: number
          profile_id?: string
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_discussion_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "club_discussion_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_discussion_poll_votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_discussion_posts: {
        Row: {
          author_profile_id: string
          category: string
          club_id: number
          content: string
          created_at: string
          id: number
          images: Json
          last_activity_at: string
          poll: Json | null
          removed_at: string | null
          removed_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_profile_id?: string
          category: string
          club_id: number
          content: string
          created_at?: string
          id?: never
          images?: Json
          last_activity_at?: string
          poll?: Json | null
          removed_at?: string | null
          removed_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          category?: string
          club_id?: number
          content?: string
          created_at?: string
          id?: never
          images?: Json
          last_activity_at?: string
          poll?: Json | null
          removed_at?: string | null
          removed_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_discussion_posts_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_discussion_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_discussion_posts_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_discussion_replies: {
        Row: {
          author_profile_id: string
          content: string
          created_at: string
          id: number
          post_id: number
          removed_at: string | null
          removed_by: string | null
        }
        Insert: {
          author_profile_id?: string
          content: string
          created_at?: string
          id?: never
          post_id: number
          removed_at?: string | null
          removed_by?: string | null
        }
        Update: {
          author_profile_id?: string
          content?: string
          created_at?: string
          id?: never
          post_id?: number
          removed_at?: string | null
          removed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_discussion_replies_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_discussion_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "club_discussion_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_discussion_replies_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_alerts: {
        Row: {
          created_at: string
          filters: Json
          id: number
          label: string
          last_sent_at: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: never
          label: string
          last_sent_at?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: never
          label?: string
          last_sent_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_event_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_board_posts: {
        Row: {
          author_profile_id: string
          content: string
          created_at: string
          event_id: number
          id: number
          last_activity_at: string
          removed_at: string | null
          removed_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_profile_id?: string
          content: string
          created_at?: string
          event_id: number
          id?: never
          last_activity_at?: string
          removed_at?: string | null
          removed_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          content?: string
          created_at?: string
          event_id?: number
          id?: never
          last_activity_at?: string
          removed_at?: string | null
          removed_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_event_board_posts_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_board_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_board_posts_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_board_replies: {
        Row: {
          author_profile_id: string
          content: string
          created_at: string
          id: number
          post_id: number
          removed_at: string | null
          removed_by: string | null
        }
        Insert: {
          author_profile_id?: string
          content: string
          created_at?: string
          id?: never
          post_id: number
          removed_at?: string | null
          removed_by?: string | null
        }
        Update: {
          author_profile_id?: string
          content?: string
          created_at?: string
          id?: never
          post_id?: number
          removed_at?: string | null
          removed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_event_board_replies_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_board_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "club_event_board_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_board_replies_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_booking_items: {
        Row: {
          booking_id: number
          id: number
          label: string
          price: string
          quantity: number
          ticket_type_id: number
          unit_amount: number
        }
        Insert: {
          booking_id: number
          id?: never
          label?: string
          price?: string
          quantity: number
          ticket_type_id: number
          unit_amount?: number
        }
        Update: {
          booking_id?: number
          id?: never
          label?: string
          price?: string
          quantity?: number
          ticket_type_id?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_event_booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "club_event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_booking_items_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "club_event_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_bookings: {
        Row: {
          cancel_reason: string
          cancelled_at: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          club_id: number
          created_at: string
          currency: string
          email: string
          event_id: number
          full_name: string
          id: number
          legacy_id: number | null
          loyalty_discount_amount: number
          loyalty_points_spent: number
          membership_tier_key: string | null
          membership_tier_label: string
          notes: string
          paid_at: string | null
          payment_method: string
          payment_note: string
          payment_status: string
          profile_id: string | null
          reference: string
          refund_status: string
          status: string
          subtotal: number
          tier_discount_amount: number
          tier_discount_percent: number
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          club_id: number
          created_at?: string
          currency?: string
          email: string
          event_id: number
          full_name: string
          id?: never
          legacy_id?: number | null
          loyalty_discount_amount?: number
          loyalty_points_spent?: number
          membership_tier_key?: string | null
          membership_tier_label?: string
          notes?: string
          paid_at?: string | null
          payment_method?: string
          payment_note?: string
          payment_status?: string
          profile_id?: string | null
          reference: string
          refund_status?: string
          status?: string
          subtotal?: number
          tier_discount_amount?: number
          tier_discount_percent?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          club_id?: number
          created_at?: string
          currency?: string
          email?: string
          event_id?: number
          full_name?: string
          id?: never
          legacy_id?: number | null
          loyalty_discount_amount?: number
          loyalty_points_spent?: number
          membership_tier_key?: string | null
          membership_tier_label?: string
          notes?: string
          paid_at?: string | null
          payment_method?: string
          payment_note?: string
          payment_status?: string
          profile_id?: string | null
          reference?: string
          refund_status?: string
          status?: string
          subtotal?: number
          tier_discount_amount?: number
          tier_discount_percent?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_event_bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_bookings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_bookings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_cart_items: {
        Row: {
          created_at: string
          event_id: number
          id: number
          profile_id: string
          quantity: number
          ticket_type_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: never
          profile_id?: string
          quantity?: number
          ticket_type_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: never
          profile_id?: string
          quantity?: number
          ticket_type_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_event_cart_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_cart_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_cart_items_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "club_event_ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_notices: {
        Row: {
          created_at: string
          event_id: number
          id: number
          message: string
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: never
          message: string
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: never
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_event_notices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_pairing_matches: {
        Row: {
          created_at: string
          event_id: number
          id: number
          pairing_id: number
          player_one: string
          player_one_id: string | null
          player_two: string
          player_two_id: string | null
          position: number
          score_one: number | null
          score_two: number | null
          table_label: string
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: never
          pairing_id: number
          player_one?: string
          player_one_id?: string | null
          player_two?: string
          player_two_id?: string | null
          position?: number
          score_one?: number | null
          score_two?: number | null
          table_label?: string
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: never
          pairing_id?: number
          player_one?: string
          player_one_id?: string | null
          player_two?: string
          player_two_id?: string | null
          position?: number
          score_one?: number | null
          score_two?: number | null
          table_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_event_pairing_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_pairing_matches_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "club_event_pairings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_pairing_matches_player_one_id_fkey"
            columns: ["player_one_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_pairing_matches_player_two_id_fkey"
            columns: ["player_two_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_pairings: {
        Row: {
          event_id: number
          id: number
          label: string | null
          matches: Json
          published: boolean
          round: number
        }
        Insert: {
          event_id: number
          id?: never
          label?: string | null
          matches?: Json
          published?: boolean
          round: number
        }
        Update: {
          event_id?: number
          id?: never
          label?: string | null
          matches?: Json
          published?: boolean
          round?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_event_pairings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_results: {
        Row: {
          army: Json
          event_id: number
          id: number
          is_member: boolean
          member_legacy_id: number | null
          member_name: string
          member_profile_id: string | null
          placement: string | null
          rank: number | null
        }
        Insert: {
          army?: Json
          event_id: number
          id?: never
          is_member?: boolean
          member_legacy_id?: number | null
          member_name?: string
          member_profile_id?: string | null
          placement?: string | null
          rank?: number | null
        }
        Update: {
          army?: Json
          event_id?: number
          id?: never
          is_member?: boolean
          member_legacy_id?: number | null
          member_name?: string
          member_profile_id?: string | null
          placement?: string | null
          rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_event_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_event_results_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_social_links: {
        Row: {
          event_id: number
          id: number
          label: string
          position: number
          url: string
        }
        Insert: {
          event_id: number
          id?: never
          label: string
          position?: number
          url: string
        }
        Update: {
          event_id?: number
          id?: never
          label?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_event_social_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
        ]
      }
      club_event_ticket_types: {
        Row: {
          audience: string | null
          audience_label: string | null
          event_id: number
          id: number
          label: string
          minimum_tier_key: string | null
          position: number
          price: string
          quantity_available: number | null
        }
        Insert: {
          audience?: string | null
          audience_label?: string | null
          event_id: number
          id?: never
          label: string
          minimum_tier_key?: string | null
          position?: number
          price?: string
          quantity_available?: number | null
        }
        Update: {
          audience?: string | null
          audience_label?: string | null
          event_id?: number
          id?: never
          label?: string
          minimum_tier_key?: string | null
          position?: number
          price?: string
          quantity_available?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_event_ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
        ]
      }
      club_events: {
        Row: {
          bestcoast_link: string | null
          cancel_reason: string | null
          club_id: number
          created_at: string
          end_date: string | null
          end_time: string | null
          event_type: string | null
          event_types: string[]
          facilities: string[]
          featured_games: string[]
          formats: string[]
          id: number
          info_board: string | null
          legacy_id: string
          logo_alt: string | null
          logo_path: string | null
          logo_src: string | null
          price: string | null
          published_at: string | null
          round_count: number | null
          start_date: string | null
          start_time: string | null
          status: string
          summary: string | null
          tickets_available: number | null
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          venue_postcode: string | null
        }
        Insert: {
          bestcoast_link?: string | null
          cancel_reason?: string | null
          club_id: number
          created_at?: string
          end_date?: string | null
          end_time?: string | null
          event_type?: string | null
          event_types?: string[]
          facilities?: string[]
          featured_games?: string[]
          formats?: string[]
          id?: never
          info_board?: string | null
          legacy_id: string
          logo_alt?: string | null
          logo_path?: string | null
          logo_src?: string | null
          price?: string | null
          published_at?: string | null
          round_count?: number | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          summary?: string | null
          tickets_available?: number | null
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          venue_postcode?: string | null
        }
        Update: {
          bestcoast_link?: string | null
          cancel_reason?: string | null
          club_id?: number
          created_at?: string
          end_date?: string | null
          end_time?: string | null
          event_type?: string | null
          event_types?: string[]
          facilities?: string[]
          featured_games?: string[]
          formats?: string[]
          id?: never
          info_board?: string | null
          legacy_id?: string
          logo_alt?: string | null
          logo_path?: string | null
          logo_src?: string | null
          price?: string | null
          published_at?: string | null
          round_count?: number | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          summary?: string | null
          tickets_available?: number | null
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          venue_postcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_facilities: {
        Row: {
          club_id: number
          facility_id: number
        }
        Insert: {
          club_id: number
          facility_id: number
        }
        Update: {
          club_id?: number
          facility_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_facilities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      club_formats: {
        Row: {
          club_id: number
          format_id: number
        }
        Insert: {
          club_id: number
          format_id: number
        }
        Update: {
          club_id?: number
          format_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_formats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_formats_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "formats"
            referencedColumns: ["id"]
          },
        ]
      }
      club_games: {
        Row: {
          club_id: number
          game_id: number
        }
        Insert: {
          club_id: number
          game_id: number
        }
        Update: {
          club_id?: number
          game_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_games_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      club_images: {
        Row: {
          alt: string
          club_id: number
          id: number
          position: number
          src: string
          storage_path: string | null
        }
        Insert: {
          alt?: string
          club_id: number
          id?: never
          position?: number
          src: string
          storage_path?: string | null
        }
        Update: {
          alt?: string
          club_id?: number
          id?: never
          position?: number
          src?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_images_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_looking_for_games: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          booking_id: number | null
          club_id: number
          club_session_id: number
          created_at: string
          created_by: string
          game_title: string
          id: number
          legacy_id: number | null
          notes: string
          session_date: string
          session_day: string
          session_label: string
          session_time: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          booking_id?: number | null
          club_id: number
          club_session_id: number
          created_at?: string
          created_by?: string
          game_title: string
          id?: never
          legacy_id?: number | null
          notes?: string
          session_date: string
          session_day?: string
          session_label?: string
          session_time?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          booking_id?: number | null
          club_id?: number
          club_session_id?: number
          created_at?: string
          created_by?: string
          game_title?: string
          id?: never
          legacy_id?: number | null
          notes?: string
          session_date?: string
          session_day?: string
          session_label?: string
          session_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_looking_for_games_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_looking_for_games_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "club_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_looking_for_games_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_looking_for_games_club_session_id_fkey"
            columns: ["club_session_id"]
            isOneToOne: false
            referencedRelation: "club_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_looking_for_games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_loyalty_settings: {
        Row: {
          anniversaries: Json
          club_id: number
          enabled: boolean
          milestones: Json
          point_value: number | null
          table_booking_price: string | null
          tiers: Json
          updated_at: string
        }
        Insert: {
          anniversaries?: Json
          club_id: number
          enabled?: boolean
          milestones?: Json
          point_value?: number | null
          table_booking_price?: string | null
          tiers?: Json
          updated_at?: string
        }
        Update: {
          anniversaries?: Json
          club_id?: number
          enabled?: boolean
          milestones?: Json
          point_value?: number | null
          table_booking_price?: string | null
          tiers?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_loyalty_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_loyalty_transactions: {
        Row: {
          available_delta: number
          category: string
          club_id: number
          created_at: string
          description: string
          id: number
          kind: string
          lifetime_delta: number
          money_amount: number | null
          profile_id: string
          source_key: string
        }
        Insert: {
          available_delta?: number
          category: string
          club_id: number
          created_at?: string
          description?: string
          id?: never
          kind: string
          lifetime_delta?: number
          money_amount?: number | null
          profile_id: string
          source_key: string
        }
        Update: {
          available_delta?: number
          category?: string
          club_id?: number
          created_at?: string
          description?: string
          id?: never
          kind?: string
          lifetime_delta?: number
          money_amount?: number | null
          profile_id?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_loyalty_transactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_loyalty_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: number
          id: number
          initials: string
          legacy_member_id: number | null
          member_profile_id: string | null
          name: string
          position: number
        }
        Insert: {
          club_id: number
          id?: never
          initials?: string
          legacy_member_id?: number | null
          member_profile_id?: string | null
          name: string
          position?: number
        }
        Update: {
          club_id?: number
          id?: never
          initials?: string
          legacy_member_id?: number | null
          member_profile_id?: string | null
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_membership_payments: {
        Row: {
          billing_option_label: string
          club_id: number
          created_at: string
          id: number
          membership_id: number
          note: string | null
          period_end_at: string | null
          period_start_at: string | null
          price: string
          price_duration: string
          profile_id: string
          recorded_by: string | null
          tier_key: string | null
          tier_label: string
        }
        Insert: {
          billing_option_label?: string
          club_id: number
          created_at?: string
          id?: never
          membership_id: number
          note?: string | null
          period_end_at?: string | null
          period_start_at?: string | null
          price?: string
          price_duration?: string
          profile_id: string
          recorded_by?: string | null
          tier_key?: string | null
          tier_label?: string
        }
        Update: {
          billing_option_label?: string
          club_id?: number
          created_at?: string
          id?: never
          membership_id?: number
          note?: string | null
          period_end_at?: string | null
          period_start_at?: string | null
          price?: string
          price_duration?: string
          profile_id?: string
          recorded_by?: string | null
          tier_key?: string | null
          tier_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_membership_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_membership_payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "club_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_membership_payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_membership_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_membership_settings: {
        Row: {
          advance_booking_dates: number | null
          basic_label: string | null
          club_id: number
          event_advance_days: number | null
          looking_for_game_future_dates: number | null
          looking_for_game_post_limit: number | null
          loyalty_redemption_cap_percent: number | null
          upcoming_booking_limit: number | null
        }
        Insert: {
          advance_booking_dates?: number | null
          basic_label?: string | null
          club_id: number
          event_advance_days?: number | null
          looking_for_game_future_dates?: number | null
          looking_for_game_post_limit?: number | null
          loyalty_redemption_cap_percent?: number | null
          upcoming_booking_limit?: number | null
        }
        Update: {
          advance_booking_dates?: number | null
          basic_label?: string | null
          club_id?: number
          event_advance_days?: number | null
          looking_for_game_future_dates?: number | null
          looking_for_game_post_limit?: number | null
          loyalty_redemption_cap_percent?: number | null
          upcoming_booking_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_membership_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_membership_tiers: {
        Row: {
          benefits: Json
          billing_options: Json
          club_id: number
          description: string | null
          id: number
          is_basic: boolean
          label: string
          position: number
          premium_badge_label: string | null
          price: string
          price_duration: string
          profile_flair: string | null
          tier_key: string
          tone: string | null
        }
        Insert: {
          benefits?: Json
          billing_options?: Json
          club_id: number
          description?: string | null
          id?: never
          is_basic?: boolean
          label: string
          position?: number
          premium_badge_label?: string | null
          price?: string
          price_duration?: string
          profile_flair?: string | null
          tier_key: string
          tone?: string | null
        }
        Update: {
          benefits?: Json
          billing_options?: Json
          club_id?: number
          description?: string | null
          id?: never
          is_basic?: boolean
          label?: string
          position?: number
          premium_badge_label?: string | null
          price?: string
          price_duration?: string
          profile_flair?: string | null
          tier_key?: string
          tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_membership_tiers_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_memberships: {
        Row: {
          club_id: number
          created_at: string
          decline_reason: string | null
          id: number
          joined_at: string | null
          profile_id: string
          requested_tier_key: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tier_assigned_at: string | null
          tier_key: string | null
          tier_requested_at: string | null
          updated_at: string
        }
        Insert: {
          club_id: number
          created_at?: string
          decline_reason?: string | null
          id?: never
          joined_at?: string | null
          profile_id: string
          requested_tier_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tier_assigned_at?: string | null
          tier_key?: string | null
          tier_requested_at?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: number
          created_at?: string
          decline_reason?: string | null
          id?: never
          joined_at?: string | null
          profile_id?: string
          requested_tier_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tier_assigned_at?: string | null
          tier_key?: string | null
          tier_requested_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_memberships_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_merchandise_items: {
        Row: {
          active: boolean
          category: string | null
          club_id: number
          description: string | null
          id: number
          image_alt: string | null
          image_src: string | null
          legacy_id: string
          minimum_tier_key: string | null
          name: string
          position: number
          price: string | null
          stock: number
        }
        Insert: {
          active?: boolean
          category?: string | null
          club_id: number
          description?: string | null
          id?: never
          image_alt?: string | null
          image_src?: string | null
          legacy_id: string
          minimum_tier_key?: string | null
          name: string
          position?: number
          price?: string | null
          stock?: number
        }
        Update: {
          active?: boolean
          category?: string | null
          club_id?: number
          description?: string | null
          id?: never
          image_alt?: string | null
          image_src?: string | null
          legacy_id?: string
          minimum_tier_key?: string | null
          name?: string
          position?: number
          price?: string | null
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_merchandise_items_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_merchandise_order_items: {
        Row: {
          discount_amount: number
          id: number
          item_id: number | null
          line_total: number
          name: string
          order_id: number
          price: string | null
          quantity: number
          unit_amount: number
          variant_id: number | null
          variant_label: string
        }
        Insert: {
          discount_amount?: number
          id?: never
          item_id?: number | null
          line_total?: number
          name: string
          order_id: number
          price?: string | null
          quantity?: number
          unit_amount?: number
          variant_id?: number | null
          variant_label?: string
        }
        Update: {
          discount_amount?: number
          id?: never
          item_id?: number | null
          line_total?: number
          name?: string
          order_id?: number
          price?: string | null
          quantity?: number
          unit_amount?: number
          variant_id?: number | null
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_merchandise_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "club_merchandise_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_merchandise_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "club_merchandise_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_merchandise_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "club_merchandise_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      club_merchandise_order_notes: {
        Row: {
          author_id: string | null
          automatic: boolean
          body: string
          created_at: string
          id: number
          order_id: number
        }
        Insert: {
          author_id?: string | null
          automatic?: boolean
          body: string
          created_at?: string
          id?: never
          order_id: number
        }
        Update: {
          author_id?: string | null
          automatic?: boolean
          body?: string
          created_at?: string
          id?: never
          order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_merchandise_order_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_merchandise_order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "club_merchandise_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      club_merchandise_orders: {
        Row: {
          club_id: number
          created_at: string
          id: number
          loyalty_discount: number
          loyalty_points_spent: number
          membership_tier_key: string | null
          membership_tier_label: string | null
          notes: string
          profile_id: string
          status: string
          status_updated_at: string
          subtotal: number
          tier_discount_amount: number
          tier_discount_percent: number
          total: number
        }
        Insert: {
          club_id: number
          created_at?: string
          id?: never
          loyalty_discount?: number
          loyalty_points_spent?: number
          membership_tier_key?: string | null
          membership_tier_label?: string | null
          notes?: string
          profile_id?: string
          status?: string
          status_updated_at?: string
          subtotal?: number
          tier_discount_amount?: number
          tier_discount_percent?: number
          total?: number
        }
        Update: {
          club_id?: number
          created_at?: string
          id?: never
          loyalty_discount?: number
          loyalty_points_spent?: number
          membership_tier_key?: string | null
          membership_tier_label?: string | null
          notes?: string
          profile_id?: string
          status?: string
          status_updated_at?: string
          subtotal?: number
          tier_discount_amount?: number
          tier_discount_percent?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_merchandise_orders_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_merchandise_orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_merchandise_variants: {
        Row: {
          active: boolean
          id: number
          item_id: number
          label: string
          position: number
          sku: string
          stock: number
        }
        Insert: {
          active?: boolean
          id?: never
          item_id: number
          label?: string
          position?: number
          sku?: string
          stock?: number
        }
        Update: {
          active?: boolean
          id?: never
          item_id?: number
          label?: string
          position?: number
          sku?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_merchandise_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "club_merchandise_items"
            referencedColumns: ["id"]
          },
        ]
      }
      club_message_reads: {
        Row: {
          club_id: number | null
          id: number
          pair_high: string
          pair_low: string
          profile_id: string
          read_at: string
        }
        Insert: {
          club_id?: number | null
          id?: never
          pair_high: string
          pair_low: string
          profile_id?: string
          read_at?: string
        }
        Update: {
          club_id?: number | null
          id?: never
          pair_high?: string
          pair_low?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_message_reads_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_message_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_messages: {
        Row: {
          club_id: number | null
          content: string
          created_at: string
          id: number
          pair_high: string | null
          pair_low: string | null
          recipient_id: string
          removed_at: string | null
          removed_by: string | null
          sender_id: string
        }
        Insert: {
          club_id?: number | null
          content: string
          created_at?: string
          id?: never
          pair_high?: string | null
          pair_low?: string | null
          recipient_id: string
          removed_at?: string | null
          removed_by?: string | null
          sender_id?: string
        }
        Update: {
          club_id?: number | null
          content?: string
          created_at?: string
          id?: never
          pair_high?: string | null
          pair_low?: string | null
          recipient_id?: string
          removed_at?: string | null
          removed_by?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_payment_methods: {
        Row: {
          club_id: number
          payment_method_id: number
        }
        Insert: {
          club_id: number
          payment_method_id: number
        }
        Update: {
          club_id?: number
          payment_method_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_payment_methods_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_payment_methods_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      club_pricing_models: {
        Row: {
          club_id: number
          id: number
          label: string
          notes: string
          position: number
          price: string
        }
        Insert: {
          club_id: number
          id?: never
          label: string
          notes?: string
          position?: number
          price?: string
        }
        Update: {
          club_id?: number
          id?: never
          label?: string
          notes?: string
          position?: number
          price?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_pricing_models_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_review_summary: {
        Row: {
          average: number | null
          club_id: number
          rating_sum: number
          review_count: number
          updated_at: string
        }
        Insert: {
          average?: number | null
          club_id: number
          rating_sum?: number
          review_count?: number
          updated_at?: string
        }
        Update: {
          average?: number | null
          club_id?: number
          rating_sum?: number
          review_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_review_summary_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_reviews: {
        Row: {
          author_legacy_id: number | null
          author_name: string
          author_profile_id: string | null
          club_id: number
          comment: string | null
          created_at: string
          flagged_at: string | null
          flagged_by: string | null
          flagged_by_name: string | null
          id: number
          rating: number
          removed_at: string | null
          removed_by: string | null
          removed_by_name: string | null
          updated_at: string
        }
        Insert: {
          author_legacy_id?: number | null
          author_name?: string
          author_profile_id?: string | null
          club_id: number
          comment?: string | null
          created_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_by_name?: string | null
          id?: number
          rating: number
          removed_at?: string | null
          removed_by?: string | null
          removed_by_name?: string | null
          updated_at?: string
        }
        Update: {
          author_legacy_id?: number | null
          author_name?: string
          author_profile_id?: string | null
          club_id?: number
          comment?: string | null
          created_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_by_name?: string | null
          id?: number
          rating?: number
          removed_at?: string | null
          removed_by?: string | null
          removed_by_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_reviews_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reviews_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reviews_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reviews_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_rivals: {
        Row: {
          club_id: number
          created_at: string
          id: number
          profile_id: string
          rival_id: string
        }
        Insert: {
          club_id: number
          created_at?: string
          id?: never
          profile_id?: string
          rival_id: string
        }
        Update: {
          club_id?: number
          created_at?: string
          id?: never
          profile_id?: string
          rival_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_rivals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_rivals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_rivals_rival_id_fkey"
            columns: ["rival_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_sessions: {
        Row: {
          club_id: number
          day: string
          id: number
          label: string
          position: number
          time: string
        }
        Insert: {
          club_id: number
          day: string
          id?: never
          label?: string
          position?: number
          time?: string
        }
        Update: {
          club_id?: number
          day?: string
          id?: never
          label?: string
          position?: number
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_social_links: {
        Row: {
          club_id: number
          id: number
          label: string
          position: number
          url: string
        }
        Insert: {
          club_id: number
          id?: never
          label: string
          position?: number
          url: string
        }
        Update: {
          club_id?: number
          id?: never
          label?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_social_links_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_submission_events: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: number
          kind: string
          submission_id: number
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: never
          kind: string
          submission_id: number
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: never
          kind?: string
          submission_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_submission_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_submission_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "club_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_submissions: {
        Row: {
          billing_required: boolean
          city: string
          club_id: number | null
          club_name: string
          created_at: string
          decline_reason: string
          id: number
          last_step: string
          owner_id: string
          payload: Json
          plan_interval: string
          restarted_from: number | null
          review_note: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          billing_required?: boolean
          city?: string
          club_id?: number | null
          club_name?: string
          created_at?: string
          decline_reason?: string
          id?: never
          last_step?: string
          owner_id?: string
          payload?: Json
          plan_interval?: string
          restarted_from?: number | null
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_required?: boolean
          city?: string
          club_id?: number | null
          club_name?: string
          created_at?: string
          decline_reason?: string
          id?: never
          last_step?: string
          owner_id?: string
          payload?: Json
          plan_interval?: string
          restarted_from?: number | null
          review_note?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_submissions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_submissions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_submissions_restarted_from_fkey"
            columns: ["restarted_from"]
            isOneToOne: false
            referencedRelation: "club_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_team: {
        Row: {
          added_by: string | null
          club_id: number
          created_at: string
          profile_id: string
          role: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          club_id: number
          created_at?: string
          profile_id: string
          role: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          club_id?: number
          created_at?: string
          profile_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_team_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_team_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_team_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_team_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          club_id: number
          created_at: string
          declined_at: string | null
          email: string | null
          expires_at: string
          id: number
          invited_by: string
          message: string
          profile_id: string | null
          revoked_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id: number
          created_at?: string
          declined_at?: string | null
          email?: string | null
          expires_at?: string
          id?: never
          invited_by: string
          message?: string
          profile_id?: string | null
          revoked_at?: string | null
          role: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id?: number
          created_at?: string
          declined_at?: string | null
          email?: string | null
          expires_at?: string
          id?: never
          invited_by?: string
          message?: string
          profile_id?: string | null
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_team_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_team_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_team_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_team_invites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          accessibility: string[]
          ages: string | null
          announcement: string | null
          city: string
          claimable: boolean
          contact_email: string | null
          contact_phone: string | null
          coordinates_label: string | null
          country: string
          created_at: string
          description: string | null
          geocode_stale: boolean
          id: number
          latitude: number | null
          legacy_created_at: string | null
          logo_path: string | null
          logo_url: string | null
          longitude: number | null
          member_count: number | null
          name: string
          neighbourhood: string | null
          owner_id: string | null
          owner_legacy_id: number | null
          price_drop_in: string | null
          price_membership: string | null
          search_haystack: string
          slug: string
          spotlight: boolean
          status: string
          summary: string | null
          tables_available: number | null
          tags: string[]
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          venue_postcode: string | null
          venue_postcode_area: string | null
          venue_postcode_district: string | null
          website_url: string | null
        }
        Insert: {
          accessibility?: string[]
          ages?: string | null
          announcement?: string | null
          city?: string
          claimable?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          coordinates_label?: string | null
          country?: string
          created_at?: string
          description?: string | null
          geocode_stale?: boolean
          id?: number
          latitude?: number | null
          legacy_created_at?: string | null
          logo_path?: string | null
          logo_url?: string | null
          longitude?: number | null
          member_count?: number | null
          name: string
          neighbourhood?: string | null
          owner_id?: string | null
          owner_legacy_id?: number | null
          price_drop_in?: string | null
          price_membership?: string | null
          search_haystack?: string
          slug: string
          spotlight?: boolean
          status?: string
          summary?: string | null
          tables_available?: number | null
          tags?: string[]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          venue_postcode?: string | null
          venue_postcode_area?: string | null
          venue_postcode_district?: string | null
          website_url?: string | null
        }
        Update: {
          accessibility?: string[]
          ages?: string | null
          announcement?: string | null
          city?: string
          claimable?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          coordinates_label?: string | null
          country?: string
          created_at?: string
          description?: string | null
          geocode_stale?: boolean
          id?: number
          latitude?: number | null
          legacy_created_at?: string | null
          logo_path?: string | null
          logo_url?: string | null
          longitude?: number | null
          member_count?: number | null
          name?: string
          neighbourhood?: string | null
          owner_id?: string | null
          owner_legacy_id?: number | null
          price_drop_in?: string | null
          price_membership?: string | null
          search_haystack?: string
          slug?: string
          spotlight?: boolean
          status?: string
          summary?: string | null
          tables_available?: number | null
          tags?: string[]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          venue_postcode?: string | null
          venue_postcode_area?: string | null
          venue_postcode_district?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
        }
        Relationships: []
      }
      featured_listings: {
        Row: {
          club_id: number
          created_at: string
          created_by: string | null
          currency: string
          ends_on: string
          id: number
          note: string
          price_pence: number
          starts_on: string
        }
        Insert: {
          club_id: number
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_on: string
          id?: never
          note?: string
          price_pence?: number
          starts_on: string
        }
        Update: {
          club_id?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          ends_on?: string
          id?: never
          note?: string
          price_pence?: number
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_listings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_listings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      formats: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
        }
        Relationships: []
      }
      game_result_armies: {
        Row: {
          battle_role: string
          catalogue_version: string | null
          club_id: number | null
          confirmed: boolean
          created_at: string
          deployment: string
          detachment: string
          disposition: string
          edition_id: string | null
          faction_id: string
          faction_label: string
          first_turn: string
          id: number
          list_id: number | null
          list_name: string
          list_version_id: number | null
          list_version_number: number | null
          mission: string
          mvp_units: string[]
          outcome: string
          painted: boolean
          played_on: string | null
          player_name: string
          primary_score: number | null
          profile_id: string | null
          secondary_score: number | null
          side: string
          snapshot: Json
          source_id: number
          source_type: string
          terrain: string
          total_vp: number | null
          underwhelming_units: string[]
        }
        Insert: {
          battle_role?: string
          catalogue_version?: string | null
          club_id?: number | null
          confirmed?: boolean
          created_at?: string
          deployment?: string
          detachment?: string
          disposition?: string
          edition_id?: string | null
          faction_id?: string
          faction_label?: string
          first_turn?: string
          id?: never
          list_id?: number | null
          list_name?: string
          list_version_id?: number | null
          list_version_number?: number | null
          mission?: string
          mvp_units?: string[]
          outcome?: string
          painted?: boolean
          played_on?: string | null
          player_name?: string
          primary_score?: number | null
          profile_id?: string | null
          secondary_score?: number | null
          side: string
          snapshot?: Json
          source_id: number
          source_type: string
          terrain?: string
          total_vp?: number | null
          underwhelming_units?: string[]
        }
        Update: {
          battle_role?: string
          catalogue_version?: string | null
          club_id?: number | null
          confirmed?: boolean
          created_at?: string
          deployment?: string
          detachment?: string
          disposition?: string
          edition_id?: string | null
          faction_id?: string
          faction_label?: string
          first_turn?: string
          id?: never
          list_id?: number | null
          list_name?: string
          list_version_id?: number | null
          list_version_number?: number | null
          mission?: string
          mvp_units?: string[]
          outcome?: string
          painted?: boolean
          played_on?: string | null
          player_name?: string
          primary_score?: number | null
          profile_id?: string | null
          secondary_score?: number | null
          side?: string
          snapshot?: Json
          source_id?: number
          source_type?: string
          terrain?: string
          total_vp?: number | null
          underwhelming_units?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "game_result_armies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_result_armies_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "army_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_result_armies_list_version_id_fkey"
            columns: ["list_version_id"]
            isOneToOne: false
            referencedRelation: "army_list_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_result_armies_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
        }
        Relationships: []
      }
      listing_billing_settings: {
        Row: {
          auto_hide_lapsed: boolean
          currency: string
          enabled: boolean
          featured_duration_days: number
          featured_price_pence: number
          grace_period_days: number
          id: number
          monthly_price_pence: number
          payment_instructions_md: string
          provider_mode: string
          reminder_days: number[]
          stripe_monthly_price_id: string
          stripe_product_id: string
          stripe_yearly_price_id: string
          updated_at: string
          updated_by: string | null
          yearly_price_pence: number
        }
        Insert: {
          auto_hide_lapsed?: boolean
          currency?: string
          enabled?: boolean
          featured_duration_days?: number
          featured_price_pence?: number
          grace_period_days?: number
          id?: number
          monthly_price_pence?: number
          payment_instructions_md?: string
          provider_mode?: string
          reminder_days?: number[]
          stripe_monthly_price_id?: string
          stripe_product_id?: string
          stripe_yearly_price_id?: string
          updated_at?: string
          updated_by?: string | null
          yearly_price_pence?: number
        }
        Update: {
          auto_hide_lapsed?: boolean
          currency?: string
          enabled?: boolean
          featured_duration_days?: number
          featured_price_pence?: number
          grace_period_days?: number
          id?: number
          monthly_price_pence?: number
          payment_instructions_md?: string
          provider_mode?: string
          reminder_days?: number[]
          stripe_monthly_price_id?: string
          stripe_product_id?: string
          stripe_yearly_price_id?: string
          updated_at?: string
          updated_by?: string | null
          yearly_price_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_billing_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_payments: {
        Row: {
          amount_pence: number
          club_id: number | null
          created_at: string
          currency: string
          id: number
          kind: string
          method: string
          note: string
          paid_at: string
          period_end: string | null
          period_start: string | null
          recorded_by: string | null
          reference: string
          subscription_id: number
        }
        Insert: {
          amount_pence: number
          club_id?: number | null
          created_at?: string
          currency?: string
          id?: never
          kind?: string
          method?: string
          note?: string
          paid_at: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          reference?: string
          subscription_id: number
        }
        Update: {
          amount_pence?: number
          club_id?: number | null
          created_at?: string
          currency?: string
          id?: never
          kind?: string
          method?: string
          note?: string
          paid_at?: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          reference?: string
          subscription_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "listing_subscription_standing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "listing_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_subscriptions: {
        Row: {
          club_id: number | null
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          id: number
          owner_id: string
          plan_interval: string
          price_pence: number
          provider_customer_id: string
          provider_subscription_id: string
          status: string
          submission_id: number | null
          updated_at: string
        }
        Insert: {
          club_id?: number | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: never
          owner_id: string
          plan_interval?: string
          price_pence?: number
          provider_customer_id?: string
          provider_subscription_id?: string
          status?: string
          submission_id?: number | null
          updated_at?: string
        }
        Update: {
          club_id?: number | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: never
          owner_id?: string
          plan_interval?: string
          price_pence?: number
          provider_customer_id?: string
          provider_subscription_id?: string
          status?: string
          submission_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_subscriptions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_subscriptions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "club_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      member_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: number
          club_id: number
          id: number
          note: string
          profile_id: string
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: number
          club_id: number
          id?: never
          note?: string
          profile_id: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: number
          club_id?: number
          id?: never
          note?: string
          profile_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "club_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_flags: {
        Row: {
          club_id: number | null
          created_at: string
          event_id: number | null
          flagged_by: string | null
          id: number
          reason: string
          resolution: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: number
          target_type: string
        }
        Insert: {
          club_id?: number | null
          created_at?: string
          event_id?: number | null
          flagged_by?: string | null
          id?: never
          reason?: string
          resolution?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: number
          target_type: string
        }
        Update: {
          club_id?: number | null
          created_at?: string
          event_id?: number | null
          flagged_by?: string | null
          id?: never
          reason?: string
          resolution?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: number
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_flags_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "club_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          entity_key: string
          kind: string
          profile_id: string
          sent_at: string
        }
        Insert: {
          entity_key?: string
          kind: string
          profile_id: string
          sent_at?: string
        }
        Update: {
          entity_key?: string
          kind?: string
          profile_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          bell: boolean
          email: boolean
          family: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          bell?: boolean
          email?: boolean
          family: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          bell?: boolean
          email?: boolean
          family?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          href: string
          id: number
          kind: string
          meta: string
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          href?: string
          id?: never
          kind: string
          meta?: string
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          href?: string
          id?: never
          kind?: string
          meta?: string
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          id: number
          label: string
          slug: string
        }
        Insert: {
          id?: never
          label: string
          slug: string
        }
        Update: {
          id?: never
          label?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_groups: string[]
          availability_days: string[]
          bio: string | null
          created_at: string
          factions_armies: string[]
          full_name: string
          games_interested: string[]
          home_postcode: string | null
          id: string
          is_active: boolean
          legacy_id: number | null
          play_style_tags: string[]
          preferred_travel_miles: number | null
          role: string
          social_profiles: Json
          updated_at: string
        }
        Insert: {
          age_groups?: string[]
          availability_days?: string[]
          bio?: string | null
          created_at?: string
          factions_armies?: string[]
          full_name?: string
          games_interested?: string[]
          home_postcode?: string | null
          id: string
          is_active?: boolean
          legacy_id?: number | null
          play_style_tags?: string[]
          preferred_travel_miles?: number | null
          role?: string
          social_profiles?: Json
          updated_at?: string
        }
        Update: {
          age_groups?: string[]
          availability_days?: string[]
          bio?: string | null
          created_at?: string
          factions_armies?: string[]
          full_name?: string
          games_interested?: string[]
          home_postcode?: string | null
          id?: string
          is_active?: boolean
          legacy_id?: number | null
          play_style_tags?: string[]
          preferred_travel_miles?: number | null
          role?: string
          social_profiles?: Json
          updated_at?: string
        }
        Relationships: []
      }
      season_coach_plans: {
        Row: {
          club_id: number
          created_at: string
          focus: Json
          focus_key: string
          goal: string
          id: number
          matches_at_write: number
          plan: Json
          profile_id: string
          retired_at: string | null
          source_signature: string
        }
        Insert: {
          club_id: number
          created_at?: string
          focus?: Json
          focus_key: string
          goal?: string
          id?: never
          matches_at_write?: number
          plan?: Json
          profile_id: string
          retired_at?: string | null
          source_signature?: string
        }
        Update: {
          club_id?: number
          created_at?: string
          focus?: Json
          focus_key?: string
          goal?: string
          id?: never
          matches_at_write?: number
          plan?: Json
          profile_id?: string
          retired_at?: string | null
          source_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_coach_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_coach_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          contact_email: string
          cookies_md: string
          id: number
          privacy_md: string
          terms_md: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact_email?: string
          cookies_md?: string
          id?: number
          privacy_md?: string
          terms_md?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact_email?: string
          cookies_md?: string
          id?: number
          privacy_md?: string
          terms_md?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unsubscribe_tokens: {
        Row: {
          created_at: string
          family: string
          profile_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          family: string
          profile_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          family?: string
          profile_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribe_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      listing_subscription_standing: {
        Row: {
          club_id: number | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          grace_ends_on: string | null
          grace_period_days: number | null
          id: number | null
          owner_id: string | null
          plan_interval: string | null
          price_pence: number | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          standing: string | null
          status: string | null
          submission_id: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_subscriptions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_subscriptions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_subscriptions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "club_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_looking_for_game: { Args: { post_id: number }; Returns: number }
      admin_account_detail: {
        Args: { p_profile: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_sign_in_at: string
          role: string
        }[]
      }
      admin_ai_usage: {
        Args: { p_months?: number }
        Returns: {
          club_id: number
          club_name: string
          failures: number
          month: string
          runs: number
          spend_pence: number
        }[]
      }
      admin_club_counts: { Args: { p_query?: string }; Returns: Json }
      admin_clubs: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
        }
        Returns: {
          city: string
          claimable: boolean
          id: number
          members: number
          name: string
          owner_name: string
          slug: string
          spotlight: boolean
          status: string
          total_count: number
        }[]
      }
      admin_create_club: {
        Args: { p_city: string; p_claimable?: boolean; p_name: string }
        Returns: Json
      }
      admin_event_counts: { Args: { p_query?: string }; Returns: Json }
      admin_events: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
          p_when?: string
        }
        Returns: {
          club_name: string
          club_slug: string
          id: number
          legacy_id: string
          places: number
          sold: number
          start_date: string
          status: string
          title: string
          total_count: number
        }[]
      }
      admin_find_accounts: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
        }
        Returns: {
          clubs_owned: number
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          memberships: number
          role: string
          team_roles: string
          total_count: number
        }[]
      }
      admin_message_contacts: {
        Args: { p_query?: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      admin_set_account_active: {
        Args: { p_active: boolean; p_profile: string; p_reason?: string }
        Returns: string
      }
      admin_set_account_role: {
        Args: { p_profile: string; p_role: string }
        Returns: string
      }
      admin_set_club_claimable: {
        Args: { p_claimable: boolean; p_club: number }
        Returns: boolean
      }
      ai_feature_allowed: {
        Args: { p_club: number; p_feature: string }
        Returns: undefined
      }
      ai_feature_benefit: { Args: { p_feature: string }; Returns: string }
      ai_feature_limit: {
        Args: { p_club: number; p_feature: string }
        Returns: number
      }
      ai_month_spend: { Args: { p_club: number }; Returns: number }
      ai_usage_window: {
        Args: { p_club: number; p_feature: string }
        Returns: {
          allowed: number
          next_available_at: string
          remaining: number
          used: number
        }[]
      }
      analytics_allowed: { Args: { p_club: number }; Returns: undefined }
      apply_unsubscribe: { Args: { p_token: string }; Returns: string }
      approve_club_claim: {
        Args: { p_claim: number; p_note?: string }
        Returns: Json
      }
      approve_club_submission: { Args: { p_id: number }; Returns: Json }
      army_builder_allowed: { Args: { p_club: number }; Returns: undefined }
      army_builder_for: {
        Args: { p_club: number }
        Returns: {
          catalogue_version: string
          edition_id: string
          enabled: boolean
        }[]
      }
      army_builders_for: {
        Args: { p_clubs: number[] }
        Returns: {
          catalogue_version: string
          club_id: number
          edition_id: string
          enabled: boolean
        }[]
      }
      army_catalogue_writable: {
        Args: { p_edition: string }
        Returns: undefined
      }
      army_copy_points: {
        Args: { p_copy: number; p_label: string; p_unit: Json }
        Returns: number
      }
      army_list_canonical: { Args: { p: Json }; Returns: string }
      army_list_signature: { Args: { p: Json }; Returns: string }
      army_option_label: {
        Args: { p_copy: number; p_label: string; p_unit: Json }
        Returns: string
      }
      army_option_models: {
        Args: { p_copy: number; p_label: string; p_unit: Json }
        Returns: number
      }
      army_published_version: {
        Args: { p_edition: string; p_working: string }
        Returns: string
      }
      army_version_published: { Args: { p_edition: string }; Returns: boolean }
      award_loyalty: {
        Args: {
          award_category: string
          award_description: string
          key: string
          money?: number
          points: number
          target_club: number
          target_profile: string
        }
        Returns: number
      }
      award_member_badge: {
        Args: { p_badge: number; p_note?: string; p_profile: string }
        Returns: number
      }
      booking_discount_percent: {
        Args: { target_club: number; target_profile: string }
        Returns: number
      }
      booking_outcome: {
        Args: { p_booked_by: number; p_opponent: number; p_side: string }
        Returns: string
      }
      can_access_event_board: {
        Args: { target_event: number }
        Returns: boolean
      }
      can_manage_club: { Args: { target_club: number }; Returns: boolean }
      can_message_member: {
        Args: { other_person: string; target_club: number }
        Returns: boolean
      }
      can_use_discussion_category: {
        Args: { category: string; target_club: number }
        Returns: boolean
      }
      cancel_club_submission: { Args: { p_id: number }; Returns: string }
      checkout_event_cart: {
        Args: {
          booking_reference: string
          buyer_email: string
          buyer_name: string
          redeem?: number
          target_event: number
        }
        Returns: number
      }
      clear_booking_result: { Args: { p_booking: number }; Returns: undefined }
      club_activity_feed: {
        Args: { p_club: number; p_days?: number; p_limit?: number }
        Returns: {
          at: string
          detail: string
          id: string
          kind: string
          ref: string
          what: string
          who: string
        }[]
      }
      club_analytics_memberships: { Args: { p_club: number }; Returns: Json }
      club_analytics_money: {
        Args: { p_club: number; p_from: string; p_to: string }
        Returns: Json
      }
      club_analytics_months: {
        Args: { p_club: number; p_months?: number }
        Returns: Json
      }
      club_analytics_nights: {
        Args: { p_club: number; p_from: string; p_to: string }
        Returns: Json
      }
      club_analytics_people: {
        Args: { p_club: number; p_from: string; p_to: string }
        Returns: Json
      }
      club_analytics_summary: {
        Args: { p_club: number; p_from: string; p_to: string }
        Returns: Json
      }
      club_badge_award_counts: {
        Args: { p_badge?: number; p_club: number; p_query?: string }
        Returns: Json
      }
      club_badge_awards: {
        Args: { p_badge?: number; p_club: number }
        Returns: {
          awarded_at: string
          badge_id: number
          icon: string
          id: number
          label: string
          member_name: string
          note: string
          profile_id: string
          tone: string
        }[]
      }
      club_badge_awards_page: {
        Args: {
          p_badge?: number
          p_club: number
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
          p_state?: string
        }
        Returns: {
          awarded_at: string
          badge_active: boolean
          badge_id: number
          icon: string
          id: number
          label: string
          member_name: string
          note: string
          profile_id: string
          tone: string
          total_count: number
        }[]
      }
      club_badges_for: {
        Args: { p_club: number }
        Returns: {
          active: boolean
          awarded: number
          description: string
          icon: string
          id: number
          label: string
          tone: string
        }[]
      }
      club_can: {
        Args: { capability: string; target_club: number }
        Returns: boolean
      }
      club_catalogue_version: {
        Args: { p_club: number }
        Returns: {
          catalogue_version: string
          edition_id: string
        }[]
      }
      club_coaching_seats: {
        Args: { p_club: number }
        Returns: {
          slot_id: number
          taken: number
        }[]
      }
      club_event_bookings_summary: {
        Args: { p_club: number; p_event?: number }
        Returns: Json
      }
      club_event_door_list: {
        Args: { p_event: number }
        Returns: {
          booking_id: number
          cancel_reason: string
          checked_in_at: string
          created_at: string
          email: string
          full_name: string
          notes: string
          payment_method: string
          payment_status: string
          profile_id: string
          reference: string
          refund_status: string
          status: string
          tickets: number
          total: number
        }[]
      }
      club_event_roster: {
        Args: { p_event: number }
        Returns: {
          bookings: number
          first_booked: string
          full_name: string
          is_member: boolean
          profile_id: string
          tickets: number
        }[]
      }
      club_may_judge: {
        Args: { p_club: number; p_target: number; p_type: string }
        Returns: boolean
      }
      club_media_club: { Args: { name: string }; Returns: number }
      club_member_form: {
        Args: { p_club: number }
        Returns: {
          draws: number
          losses: number
          member_id: string
          played: number
          wins: number
        }[]
      }
      club_member_games: {
        Args: { p_club: number; p_member: string }
        Returns: {
          competition: string
          game_title: string
          my_score: number
          opponent_id: string
          opponent_name: string
          played_on: string
          ref_id: number
          source: string
          their_score: number
        }[]
      }
      club_moderation_counts: {
        Args: { p_club: number; p_query?: string; p_type?: string }
        Returns: Json
      }
      club_moderation_queue: {
        Args: {
          p_club: number
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
          p_type?: string
        }
        Returns: {
          author_id: string
          author_name: string
          body: string
          club_name: string
          club_slug: string
          created_at: string
          id: number
          reason: string
          reporter_name: string
          resolution: string
          status: string
          target_gone: boolean
          target_id: number
          target_type: string
          title: string
          total_count: number
        }[]
      }
      club_rivalries: {
        Args: { p_club: number }
        Returns: {
          draws: number
          last_played: string
          member_one: string
          member_one_name: string
          member_two: string
          member_two_name: string
          mutual: boolean
          nominations: number
          played: number
          score_one: number
          score_two: number
          wins_one: number
          wins_two: number
        }[]
      }
      club_rivalry_games: {
        Args: { p_club: number }
        Returns: {
          competition: string
          game_title: string
          high: string
          high_score: number
          low: string
          low_score: number
          played_on: string
          ref_id: number
          source: string
        }[]
      }
      club_rivalry_matches: {
        Args: { p_club: number; p_one: string; p_two: string }
        Returns: {
          booking_id: number
          competition: string
          game_title: string
          score_one: number
          score_two: number
          session_date: string
          source: string
        }[]
      }
      club_rivalry_upcoming: {
        Args: { p_club: number; p_one: string; p_two: string }
        Returns: {
          booked_by_name: string
          booking_id: number
          game_title: string
          notes: string
          session_date: string
          session_label: string
          session_time: string
        }[]
      }
      club_role_capabilities: { Args: { p_role: string }; Returns: string[] }
      club_role_for: {
        Args: { target_club: number; target_profile: string }
        Returns: string
      }
      club_role_of: { Args: { target_club: number }; Returns: string }
      create_club_event: {
        Args: { p_club: number; p_start_date: string; p_title: string }
        Returns: number
      }
      decline_club_claim: {
        Args: { p_claim: number; p_note: string }
        Returns: string
      }
      decline_club_submission: {
        Args: { p_id: number; p_reason: string }
        Returns: string
      }
      delete_army_list: { Args: { p_list: number }; Returns: undefined }
      delete_army_unit: {
        Args: { p_edition: string; p_unit: number }
        Returns: boolean
      }
      delete_event_placing: {
        Args: { p_event: number; p_placing: number }
        Returns: undefined
      }
      edit_booking_details: {
        Args: {
          p_booked_by?: string
          p_booking: number
          p_game_title: string
          p_notes: string
          p_opponent_id?: string
          p_opponent_name: string
          p_set_people?: boolean
        }
        Returns: undefined
      }
      event_alerts_due: {
        Args: { p_limit?: number }
        Returns: {
          filters: Json
          id: number
          label: string
          profile_id: string
          since: string
        }[]
      }
      event_has_ended: { Args: { target_event: number }; Returns: boolean }
      event_tickets_taken: {
        Args: { p_event: number }
        Returns: {
          taken: number
          ticket_type_id: number
        }[]
      }
      event_tickets_taken_many: {
        Args: { p_events: number[] }
        Returns: {
          event_id: number
          remaining: number
        }[]
      }
      expire_listing_subscription: {
        Args: { p_subscription: number }
        Returns: string
      }
      feature_club: {
        Args: {
          p_club: number
          p_from: string
          p_note?: string
          p_price_pence?: number
          p_to: string
        }
        Returns: number
      }
      featured_clubs: {
        Args: { p_limit?: number }
        Returns: {
          club_id: number
          paid: boolean
          slug: string
        }[]
      }
      finish_ai_job: {
        Args: {
          p_cost_pence: number
          p_error?: string
          p_job: number
          p_latency_ms: number
          p_model: string
          p_provider: string
          p_result: Json
          p_tokens_cached: number
          p_tokens_in: number
          p_tokens_out: number
        }
        Returns: undefined
      }
      flag_author: { Args: { p_id: number; p_type: string }; Returns: string }
      flag_content: {
        Args: { p_id: number; p_reason?: string; p_type: string }
        Returns: number
      }
      generate_unique_club_slug: {
        Args: { p_city: string; p_name: string }
        Returns: string
      }
      head_to_head: {
        Args: never
        Returns: {
          draws: number
          last_played: string
          losses: number
          opponent_id: string
          opponent_name: string
          played: number
          wins: number
        }[]
      }
      invite_club_team_member: {
        Args: {
          p_club: number
          p_email?: string
          p_profile?: string
          p_role: string
        }
        Returns: number
      }
      invite_preview: {
        Args: { p_token: string }
        Returns: {
          club_name: string
          club_slug: string
          has_account: boolean
          invited_by: string
          role: string
          status: string
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_club_member: { Args: { target_club: number }; Returns: boolean }
      is_service_request: { Args: never; Returns: boolean }
      issue_unsubscribe_token: {
        Args: { p_family: string; p_profile: string }
        Returns: string
      }
      link_event_result_member: {
        Args: { p_profile: string; p_result: number }
        Returns: undefined
      }
      link_result_army_list: {
        Args: {
          p_list: number
          p_side: string
          p_source: string
          p_source_id: number
        }
        Returns: undefined
      }
      link_standing_member: {
        Args: { p_profile: string; p_standing: number }
        Returns: undefined
      }
      listing_plan_days: { Args: { p_interval: string }; Returns: number }
      listing_public_prices: {
        Args: never
        Returns: {
          currency: string
          enabled: boolean
          monthly_price_pence: number
          yearly_price_pence: number
        }[]
      }
      listing_subscriptions_due: {
        Args: { p_stage: string }
        Returns: {
          club_id: number
          club_name: string
          club_slug: string
          days_left: number
          owner_id: string
          period_end: string
          plan_interval: string
          price_pence: number
          subscription_id: number
        }[]
      }
      log_club_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_club: number
          p_entity: string
          p_entity_id: string
        }
        Returns: number
      }
      london_day: { Args: { p_at: string }; Returns: string }
      london_today: { Args: never; Returns: string }
      loyalty_wallet: {
        Args: { target_club: number; target_profile: string }
        Returns: {
          available: number
          entries: number
          lifetime: number
        }[]
      }
      manages_club: {
        Args: { target_club: number; target_profile: string }
        Returns: boolean
      }
      mark_ai_job_running: { Args: { p_job: number }; Returns: undefined }
      mark_event_alerts_sent: { Args: { p_ids: number[] }; Returns: number }
      member_badges_for: {
        Args: { p_club: number; p_profile: string }
        Returns: {
          awarded_at: string
          badge_id: number
          description: string
          icon: string
          id: number
          label: string
          note: string
          tone: string
        }[]
      }
      member_event_history: {
        Args: { p_member: string }
        Returns: {
          booking_id: number
          club_name: string
          club_slug: string
          event_legacy_id: string
          event_title: string
          is_past: boolean
          start_date: string
          start_time: string
          tickets: number
        }[]
      }
      member_tier: {
        Args: { target_club: number; target_profile: string }
        Returns: {
          benefits: Json
          tier_key: string
          tier_label: string
          tier_position: number
        }[]
      }
      memberships_expiring: {
        Args: { p_within?: string }
        Returns: {
          club_name: string
          club_slug: string
          ends_at: string
          membership_id: number
          profile_id: string
          tier_key: string
        }[]
      }
      memberships_lapsed: {
        Args: { p_since?: string }
        Returns: {
          club_name: string
          club_slug: string
          ends_at: string
          membership_id: number
          profile_id: string
          tier_key: string
        }[]
      }
      merch_bag_lines: {
        Args: { lines: Json }
        Returns: {
          item_id: number
          quantity: number
          variant_id: number
        }[]
      }
      merch_price_amount: { Args: { raw: string }; Returns: number }
      message_preview: { Args: { p_content: string }; Returns: string }
      message_sender_line: {
        Args: { p_club: number; p_sender: string }
        Returns: string
      }
      meta_battle_context: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          early_signal: boolean
          games: number
          kind: string
          value: string
          win_rate: number
          wins: number
        }[]
      }
      meta_detachments: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          appearances: number
          detachment: string
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          win_rate: number
          wins: number
        }[]
      }
      meta_dispositions: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          appearances: number
          detachment: string
          disposition: string
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          win_rate: number
          wins: number
        }[]
      }
      meta_event: {
        Args: { p_event: number }
        Returns: {
          appearances: number
          detachment: string
          disposition: string
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          win_rate: number
          wins: number
        }[]
      }
      meta_factions: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          appearances: number
          average_vp: number
          draws: number
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          losses: number
          podiums: number
          representation: number
          win_rate: number
          wins: number
        }[]
      }
      meta_lists: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          appearances: number
          average_vp: number
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          list_name: string
          list_version_id: number
          version_number: number
          win_rate: number
          wins: number
        }[]
      }
      meta_matchups: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          opponent_id: string
          opponent_label: string
          win_rate: number
          wins: number
        }[]
      }
      meta_member: {
        Args: { p_profile: string }
        Returns: {
          appearances: number
          draws: number
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          losses: number
          win_rate: number
          wins: number
        }[]
      }
      meta_rows: {
        Args: { p_club: number; p_from: string; p_to: string }
        Returns: {
          battle_role: string
          catalogue_version: string | null
          club_id: number | null
          confirmed: boolean
          created_at: string
          deployment: string
          detachment: string
          disposition: string
          edition_id: string | null
          faction_id: string
          faction_label: string
          first_turn: string
          id: number
          list_id: number | null
          list_name: string
          list_version_id: number | null
          list_version_number: number | null
          mission: string
          mvp_units: string[]
          outcome: string
          painted: boolean
          played_on: string | null
          player_name: string
          primary_score: number | null
          profile_id: string | null
          secondary_score: number | null
          side: string
          snapshot: Json
          source_id: number
          source_type: string
          terrain: string
          total_vp: number | null
          underwhelming_units: string[]
        }[]
        SetofOptions: {
          from: "*"
          to: "game_result_armies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      meta_scope_allowed: { Args: { p_club: number }; Returns: undefined }
      meta_scope_counts: {
        Args: never
        Returns: {
          club_id: number
          club_name: string
          tracked: number
        }[]
      }
      meta_trend: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          bucket: string
          faction_id: string
          faction_label: string
          games: number
          win_rate: number
          wins: number
        }[]
      }
      meta_units: {
        Args: { p_club?: number; p_from?: string; p_to?: string }
        Returns: {
          early_signal: boolean
          faction_id: string
          faction_label: string
          games: number
          mvp: number
          underwhelming: number
          unit_name: string
        }[]
      }
      moderation_queue: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
          p_type?: string
        }
        Returns: {
          author_id: string
          author_name: string
          body: string
          club_name: string
          club_slug: string
          created_at: string
          id: number
          reason: string
          reporter_name: string
          resolution: string
          status: string
          target_gone: boolean
          target_id: number
          target_type: string
          title: string
          total_count: number
        }[]
      }
      moderation_queue_counts: {
        Args: { p_query?: string; p_type?: string }
        Returns: Json
      }
      money_amount: { Args: { raw: string }; Returns: number }
      money_from_text: { Args: { p_value: string }; Returns: number }
      my_managed_club_ids: { Args: never; Returns: number[] }
      my_member_club_ids: { Args: never; Returns: number[] }
      my_report_counts: {
        Args: { p_query?: string; p_type?: string }
        Returns: Json
      }
      my_reports: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
          p_status?: string
          p_type?: string
        }
        Returns: {
          body: string
          club_name: string
          club_slug: string
          created_at: string
          id: number
          reason: string
          resolution: string
          resolved_at: string
          status: string
          target_gone: boolean
          target_type: string
          title: string
          total_count: number
        }[]
      }
      my_team_club_ids: { Args: never; Returns: number[] }
      notify_person: {
        Args: {
          p_body?: string
          p_entity_id?: string
          p_entity_type?: string
          p_href?: string
          p_kind: string
          p_meta?: string
          p_target: string
          p_title: string
        }
        Returns: undefined
      }
      pause_club_listing: { Args: { p_club: number }; Returns: string }
      place_merchandise_cart_order: {
        Args: { lines: Json; note?: string; redeem?: number }
        Returns: number
      }
      place_merchandise_order: {
        Args: {
          note?: string
          redeem?: number
          target_item: number
          want: number
        }
        Returns: number
      }
      price_army_list: {
        Args: {
          p_edition: string
          p_faction: string
          p_units: Json
          p_version: string
        }
        Returns: Json
      }
      promote_next_for_session: {
        Args: { target_date: string; target_session: number }
        Returns: number
      }
      promote_waitlist_entry: { Args: { entry_id: number }; Returns: number }
      promote_waitlist_entry_as_manager: {
        Args: { entry_id: number }
        Returns: number
      }
      prune_club_audit_log: { Args: never; Returns: number }
      prune_notification_deliveries: {
        Args: { keep?: string }
        Returns: number
      }
      prune_notifications: { Args: { keep?: string }; Returns: number }
      publish_army_catalogue: {
        Args: { p_edition: string; p_note?: string }
        Returns: string
      }
      put_result_army: {
        Args: {
          p_army: Json
          p_club: number
          p_edition: string
          p_name: string
          p_played_on: string
          p_profile: string
          p_side: string
          p_source: string
          p_source_id: number
          p_version: string
        }
        Returns: number
      }
      record_booking_result: {
        Args: {
          p_armies?: Json
          p_booked_by_army?: string
          p_booked_by_score: number
          p_booking: number
          p_confirmation?: string
          p_deployment?: string
          p_mission?: string
          p_opponent_army?: string
          p_opponent_score: number
          p_terrain?: string
        }
        Returns: undefined
      }
      record_delivery: {
        Args: { p_key?: string; p_kind: string; p_profile: string }
        Returns: boolean
      }
      record_listing_payment: {
        Args: {
          p_amount_pence: number
          p_method: string
          p_note?: string
          p_paid_at?: string
          p_reference?: string
          p_subscription: number
        }
        Returns: number
      }
      refresh_club_review_summary: {
        Args: { p_club: number }
        Returns: undefined
      }
      remove_club_team_member: {
        Args: { p_club: number; p_profile: string }
        Returns: string
      }
      remove_discussion_post: { Args: { target: number }; Returns: number }
      remove_discussion_reply: { Args: { target: number }; Returns: number }
      request_submission_changes: {
        Args: { p_id: number; p_note: string }
        Returns: string
      }
      request_tier_upgrade: {
        Args: { membership: number; wanted: string }
        Returns: string
      }
      resolve_club_flag: {
        Args: { p_action: string; p_flag: number; p_reason?: string }
        Returns: boolean
      }
      resolve_moderation_flag: {
        Args: { p_action: string; p_flag: number; p_reason?: string }
        Returns: boolean
      }
      resolve_result_army: {
        Args: {
          p_detachment: string
          p_disposition: string
          p_edition: string
          p_faction: string
          p_version: string
        }
        Returns: {
          detachment: string
          faction_id: string
          faction_label: string
        }[]
      }
      resolve_tier_request: { Args: { membership: number }; Returns: undefined }
      resolve_unsubscribe_token: {
        Args: { p_token: string }
        Returns: {
          already_off: boolean
          family: string
        }[]
      }
      respond_club_team_invite: {
        Args: { p_accept: boolean; p_token: string }
        Returns: number
      }
      restart_club_submission: { Args: { p_id: number }; Returns: number }
      result_army_label: { Args: { p_army: Json }; Returns: string }
      resume_club_listing: { Args: { p_club: number }; Returns: string }
      revoke_club_team_invite: { Args: { p_invite: number }; Returns: number }
      revoke_member_badge: { Args: { p_award: number }; Returns: boolean }
      save_army_builder_settings: {
        Args: { p_club: number; p_edition?: string; p_enabled: boolean }
        Returns: boolean
      }
      save_army_detachment: {
        Args: {
          p_dispositions?: string[]
          p_edition: string
          p_faction: string
          p_label: string
          p_position?: number
          p_slug: string
        }
        Returns: number
      }
      save_army_edition: {
        Args: {
          p_edition: string
          p_edition_label: string
          p_points: string[]
          p_system: string
          p_system_label: string
          p_version: string
        }
        Returns: string
      }
      save_army_faction: {
        Args: {
          p_edition: string
          p_id: string
          p_label: string
          p_position?: number
        }
        Returns: string
      }
      save_army_list: {
        Args: {
          p_club: number
          p_list: number
          p_payload: Json
          p_summary?: string
        }
        Returns: Json
      }
      save_army_unit: {
        Args: {
          p_edition: string
          p_faction: string
          p_name: string
          p_options?: Json
          p_points: number
          p_position?: number
          p_rules?: Json
        }
        Returns: number
      }
      save_club_badge: {
        Args: {
          p_active?: boolean
          p_badge: number
          p_club: number
          p_description: string
          p_icon: string
          p_label: string
          p_tone: string
        }
        Returns: number
      }
      save_club_discussion_categories: {
        Args: { p_club: number; p_rows: Json }
        Returns: number
      }
      save_club_schedule: {
        Args: { p_club: number; p_rows: Json }
        Returns: number
      }
      save_club_taxonomy: {
        Args: { p_club: number; p_kind: string; p_labels: string[] }
        Returns: number
      }
      save_club_tiers: {
        Args: { p_club: number; p_rows: Json }
        Returns: number
      }
      save_event_placing: {
        Args: {
          p_detachment: string
          p_disposition?: string
          p_event: number
          p_faction: string
          p_name: string
          p_placing: number
          p_profile: string
          p_rank: number
        }
        Returns: number
      }
      save_notification_preference: {
        Args: { p_bell: boolean; p_email: boolean; p_family: string }
        Returns: undefined
      }
      save_pairing_armies: {
        Args: { p_armies: Json; p_match: number }
        Returns: boolean
      }
      save_season_plan: {
        Args: {
          p_club: number
          p_focus: Json
          p_focus_key: string
          p_goal: string
          p_matches: number
          p_plan: Json
          p_signature: string
        }
        Returns: number
      }
      set_club_team_role: {
        Args: { p_club: number; p_profile: string; p_role: string }
        Returns: string
      }
      set_event_bestcoast_link: {
        Args: { p_event: number; p_url: string }
        Returns: string
      }
      slugify: { Args: { p_value: string }; Returns: string }
      start_ai_job: {
        Args: {
          p_club: number
          p_feature: string
          p_force?: boolean
          p_payload?: Json
          p_signature?: string
          p_source?: Json
        }
        Returns: Json
      }
      start_army_catalogue_draft: {
        Args: { p_edition: string; p_version: string }
        Returns: string
      }
      start_listing_subscription: {
        Args: {
          p_club: number
          p_interval?: string
          p_owner: string
          p_submission: number
        }
        Returns: number
      }
      submit_club_submission: { Args: { p_id: number }; Returns: string }
      sweep_ai_jobs: { Args: never; Returns: number }
      sync_loyalty_anniversaries: {
        Args: { target_club: number; target_profile: string }
        Returns: number
      }
      tickets_taken: { Args: { target_type: number }; Returns: number }
      transfer_club_ownership: {
        Args: { p_club: number; p_to: string }
        Returns: string
      }
      unfeature_club: { Args: { p_slot: number }; Returns: boolean }
      warn_expiring_memberships: { Args: { within?: string }; Returns: number }
      withdraw_moderation_flag: { Args: { p_flag: number }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
