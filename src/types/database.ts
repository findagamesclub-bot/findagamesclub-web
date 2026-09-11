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
          cancelled_at: string | null
          cancelled_by: string | null
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
          profile_id: string | null
          reference: string
          status: string
          subtotal: number
          tier_discount_amount: number
          tier_discount_percent: number
          total: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          profile_id?: string | null
          reference: string
          status?: string
          subtotal?: number
          tier_discount_amount?: number
          tier_discount_percent?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          profile_id?: string | null
          reference?: string
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
      club_event_pairings: {
        Row: {
          event_id: number
          id: number
          label: string | null
          matches: Json
          round: number
        }
        Insert: {
          event_id: number
          id?: never
          label?: string | null
          matches?: Json
          round: number
        }
        Update: {
          event_id?: number
          id?: never
          label?: string | null
          matches?: Json
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
          logo_src: string | null
          price: string | null
          round_count: number | null
          start_date: string | null
          start_time: string | null
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
          logo_src?: string | null
          price?: string | null
          round_count?: number | null
          start_date?: string | null
          start_time?: string | null
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
          logo_src?: string | null
          price?: string | null
          round_count?: number | null
          start_date?: string | null
          start_time?: string | null
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
    }
    Views: {
      [_ in never]: never
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
      booking_discount_percent: {
        Args: { target_club: number; target_profile: string }
        Returns: number
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
      club_can: {
        Args: { capability: string; target_club: number }
        Returns: boolean
      }
      club_coaching_seats: {
        Args: { p_club: number }
        Returns: {
          slot_id: number
          taken: number
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
      event_has_ended: { Args: { target_event: number }; Returns: boolean }
      event_tickets_taken: {
        Args: { p_event: number }
        Returns: {
          taken: number
          ticket_type_id: number
        }[]
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
      link_event_result_member: {
        Args: { p_profile: string; p_result: number }
        Returns: undefined
      }
      link_standing_member: {
        Args: { p_profile: string; p_standing: number }
        Returns: undefined
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
      money_amount: { Args: { raw: string }; Returns: number }
      my_managed_club_ids: { Args: never; Returns: number[] }
      my_member_club_ids: { Args: never; Returns: number[] }
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
      prune_notifications: { Args: { keep?: string }; Returns: number }
      record_booking_result: {
        Args: {
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
      remove_club_team_member: {
        Args: { p_club: number; p_profile: string }
        Returns: string
      }
      remove_discussion_post: { Args: { target: number }; Returns: number }
      remove_discussion_reply: { Args: { target: number }; Returns: number }
      request_tier_upgrade: {
        Args: { membership: number; wanted: string }
        Returns: string
      }
      resolve_tier_request: { Args: { membership: number }; Returns: undefined }
      respond_club_team_invite: {
        Args: { p_accept: boolean; p_token: string }
        Returns: number
      }
      revoke_club_team_invite: { Args: { p_invite: number }; Returns: number }
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
          p_event: number
          p_faction: string
          p_name: string
          p_placing: number
          p_profile: string
          p_rank: number
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
      sync_loyalty_anniversaries: {
        Args: { target_club: number; target_profile: string }
        Returns: number
      }
      tickets_taken: { Args: { target_type: number }; Returns: number }
      transfer_club_ownership: {
        Args: { p_club: number; p_to: string }
        Returns: string
      }
      warn_expiring_memberships: { Args: { within?: string }; Returns: number }
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
