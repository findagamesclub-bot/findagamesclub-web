/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate after every schema change so TypeScript catches breakage at
 * compile time rather than at runtime. Via the Supabase MCP
 * `generate_typescript_types` tool, or:
 *   supabase gen types typescript --project-id hpiqdqrzmhvwnplotfnn
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" };
  public: {
    Tables: {
      clubs: {
        Row: {
          accessibility: string[];
          ages: string | null;
          announcement: string | null;
          city: string;
          contact_email: string | null;
          contact_phone: string | null;
          coordinates_label: string | null;
          country: string;
          created_at: string;
          description: string | null;
          id: number;
          latitude: number | null;
          legacy_created_at: string | null;
          logo_url: string | null;
          longitude: number | null;
          member_count: number | null;
          name: string;
          neighbourhood: string | null;
          owner_id: string | null;
          owner_legacy_id: number | null;
          price_drop_in: string | null;
          price_membership: string | null;
          search_haystack: string;
          slug: string;
          spotlight: boolean;
          status: string;
          summary: string | null;
          tables_available: number | null;
          tags: string[];
          updated_at: string;
          venue_address: string | null;
          venue_name: string | null;
          venue_postcode: string | null;
          venue_postcode_area: string | null;
          venue_postcode_district: string | null;
          website_url: string | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["clubs"]["Row"], "id" | "name" | "slug">> & {
          id: number;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["clubs"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          age_groups: string[];
          availability_days: string[];
          bio: string | null;
          created_at: string;
          factions_armies: string[];
          full_name: string;
          games_interested: string[];
          home_postcode: string | null;
          id: string;
          is_active: boolean;
          legacy_id: number | null;
          play_style_tags: string[];
          preferred_travel_miles: number | null;
          role: string;
          social_profiles: Json;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["profiles"]["Row"], "id">> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      club_images: {
        Row: { alt: string; club_id: number; id: number; position: number; src: string };
        Insert: { alt?: string; club_id: number; position?: number; src: string };
        Update: Partial<{ alt: string; club_id: number; position: number; src: string }>;
        Relationships: [
          { foreignKeyName: "club_images_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_social_links: {
        Row: { club_id: number; id: number; label: string; position: number; url: string };
        Insert: { club_id: number; label: string; position?: number; url: string };
        Update: Partial<{ club_id: number; label: string; position: number; url: string }>;
        Relationships: [
          { foreignKeyName: "club_social_links_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_sessions: {
        Row: { club_id: number; day: string; id: number; label: string; position: number; time: string };
        Insert: { club_id: number; day: string; label?: string; position?: number; time?: string };
        Update: Partial<{ club_id: number; day: string; label: string; position: number; time: string }>;
        Relationships: [
          { foreignKeyName: "club_sessions_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_pricing_models: {
        Row: { club_id: number; id: number; label: string; notes: string; position: number; price: string };
        Insert: { club_id: number; label: string; notes?: string; position?: number; price?: string };
        Update: Partial<{ club_id: number; label: string; notes: string; position: number; price: string }>;
        Relationships: [
          { foreignKeyName: "club_pricing_models_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_announcements: {
        Row: { club_id: number; created_at: string; id: number; message: string };
        Insert: { club_id: number; created_at?: string; id: number; message: string };
        Update: Partial<{ club_id: number; created_at: string; id: number; message: string }>;
        Relationships: [
          { foreignKeyName: "club_announcements_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_membership_tiers: {
        Row: {
          benefits: Json;
          billing_options: Json;
          club_id: number;
          description: string | null;
          id: number;
          is_basic: boolean;
          label: string;
          position: number;
          premium_badge_label: string | null;
          price: string;
          price_duration: string;
          profile_flair: string | null;
          tier_key: string;
          tone: string | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["club_membership_tiers"]["Row"], "id" | "club_id" | "label" | "tier_key">> & {
          club_id: number;
          label: string;
          tier_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["club_membership_tiers"]["Row"]>;
        Relationships: [
          { foreignKeyName: "club_membership_tiers_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_memberships: {
        Row: {
          club_id: number;
          created_at: string;
          decline_reason: string | null;
          id: number;
          joined_at: string | null;
          profile_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          tier_assigned_at: string | null;
          tier_key: string | null;
          updated_at: string;
        };
        Insert: {
          club_id: number;
          created_at?: string;
          decline_reason?: string | null;
          id?: never;
          joined_at?: string | null;
          profile_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tier_assigned_at?: string | null;
          tier_key?: string | null;
          updated_at?: string;
        };
        Update: {
          club_id?: number;
          created_at?: string;
          decline_reason?: string | null;
          id?: never;
          joined_at?: string | null;
          profile_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tier_assigned_at?: string | null;
          tier_key?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      club_membership_payments: {
        Row: {
          billing_option_label: string;
          club_id: number;
          created_at: string;
          id: number;
          membership_id: number;
          note: string | null;
          period_end_at: string | null;
          period_start_at: string | null;
          price: string;
          price_duration: string;
          profile_id: string;
          recorded_by: string | null;
          tier_key: string | null;
          tier_label: string;
        };
        Insert: {
          billing_option_label?: string;
          club_id: number;
          created_at?: string;
          id?: never;
          membership_id: number;
          note?: string | null;
          period_end_at?: string | null;
          period_start_at?: string | null;
          price?: string;
          price_duration?: string;
          profile_id: string;
          recorded_by?: string | null;
          tier_key?: string | null;
          tier_label?: string;
        };
        Update: {
          billing_option_label?: string;
          club_id?: number;
          created_at?: string;
          id?: never;
          membership_id?: number;
          note?: string | null;
          period_end_at?: string | null;
          period_start_at?: string | null;
          price?: string;
          price_duration?: string;
          profile_id?: string;
          recorded_by?: string | null;
          tier_key?: string | null;
          tier_label?: string;
        };
        Relationships: [];
      };
      club_membership_settings: {
        Row: {
          advance_booking_dates: number | null;
          basic_label: string | null;
          club_id: number;
          event_advance_days: number | null;
          looking_for_game_future_dates: number | null;
          looking_for_game_post_limit: number | null;
          loyalty_redemption_cap_percent: number | null;
          upcoming_booking_limit: number | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["club_membership_settings"]["Row"], "club_id">> & { club_id: number };
        Update: Partial<Database["public"]["Tables"]["club_membership_settings"]["Row"]>;
        Relationships: [
          { foreignKeyName: "club_membership_settings_club_id_fkey"; columns: ["club_id"]; isOneToOne: true; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_members: {
        Row: {
          club_id: number;
          id: number;
          initials: string;
          legacy_member_id: number | null;
          member_profile_id: string | null;
          name: string;
          position: number;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["club_members"]["Row"], "id" | "club_id" | "name">> & {
          club_id: number;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["club_members"]["Row"]>;
        Relationships: [
          { foreignKeyName: "club_members_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_events: {
        Row: {
          bestcoast_link: string | null;
          club_id: number;
          created_at: string;
          end_date: string | null;
          end_time: string | null;
          event_type: string | null;
          event_types: string[];
          facilities: string[];
          featured_games: string[];
          formats: string[];
          id: number;
          info_board: string | null;
          legacy_id: string;
          logo_alt: string | null;
          logo_src: string | null;
          price: string | null;
          round_count: number | null;
          start_date: string | null;
          start_time: string | null;
          summary: string | null;
          tickets_available: number | null;
          title: string;
          updated_at: string;
          venue_address: string | null;
          venue_name: string | null;
          venue_postcode: string | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["club_events"]["Row"], "id" | "club_id" | "legacy_id" | "title">> & {
          club_id: number;
          legacy_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["club_events"]["Row"]>;
        Relationships: [
          { foreignKeyName: "club_events_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_event_social_links: {
        Row: { event_id: number; id: number; label: string; position: number; url: string };
        Insert: { event_id: number; label: string; position?: number; url: string };
        Update: Partial<{ event_id: number; label: string; position: number; url: string }>;
        Relationships: [
          { foreignKeyName: "club_event_social_links_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "club_events"; referencedColumns: ["id"] },
        ];
      };
      club_event_ticket_types: {
        Row: {
          audience: string | null;
          audience_label: string | null;
          event_id: number;
          id: number;
          label: string;
          minimum_tier_key: string | null;
          position: number;
          price: string;
          quantity_available: number | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["club_event_ticket_types"]["Row"], "id" | "event_id" | "label">> & {
          event_id: number;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["club_event_ticket_types"]["Row"]>;
        Relationships: [
          { foreignKeyName: "club_event_ticket_types_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "club_events"; referencedColumns: ["id"] },
        ];
      };
      club_event_notices: {
        Row: { created_at: string; event_id: number; id: number; message: string };
        Insert: { created_at?: string; event_id: number; message: string };
        Update: Partial<{ created_at: string; event_id: number; message: string }>;
        Relationships: [
          { foreignKeyName: "club_event_notices_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "club_events"; referencedColumns: ["id"] },
        ];
      };
      club_event_results: {
        Row: {
          army: Json;
          event_id: number;
          id: number;
          is_member: boolean;
          member_legacy_id: number | null;
          member_name: string;
          member_profile_id: string | null;
          placement: string | null;
          rank: number | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["club_event_results"]["Row"], "id" | "event_id">> & { event_id: number };
        Update: Partial<Database["public"]["Tables"]["club_event_results"]["Row"]>;
        Relationships: [
          { foreignKeyName: "club_event_results_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "club_events"; referencedColumns: ["id"] },
        ];
      };
      club_event_pairings: {
        Row: { event_id: number; id: number; label: string | null; matches: Json; round: number };
        Insert: { event_id: number; label?: string | null; matches?: Json; round: number };
        Update: Partial<{ event_id: number; label: string | null; matches: Json; round: number }>;
        Relationships: [
          { foreignKeyName: "club_event_pairings_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "club_events"; referencedColumns: ["id"] },
        ];
      };
      club_discussion_posts: {
        Row: {
          author_profile_id: string;
          category: string;
          club_id: number;
          content: string;
          created_at: string;
          id: number;
          poll: Json | null;
          removed_at: string | null;
          removed_by: string | null;
          title: string;
          updated_at: string;
        };
        Insert: { club_id: number; category: string; title: string; content: string; poll?: Json | null };
        Update: { removed_at?: string | null; removed_by?: string | null; updated_at?: string };
        Relationships: [
          { foreignKeyName: "club_discussion_posts_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_discussion_replies: {
        Row: {
          author_profile_id: string;
          content: string;
          created_at: string;
          id: number;
          post_id: number;
          removed_at: string | null;
          removed_by: string | null;
        };
        Insert: { post_id: number; content: string };
        Update: { removed_at?: string | null; removed_by?: string | null };
        Relationships: [
          { foreignKeyName: "club_discussion_replies_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "club_discussion_posts"; referencedColumns: ["id"] },
        ];
      };
      club_discussion_poll_votes: {
        Row: { id: number; option_key: string; post_id: number; profile_id: string; voted_at: string };
        Insert: { post_id: number; option_key: string };
        Update: { option_key?: string; voted_at?: string };
        Relationships: [
          { foreignKeyName: "club_discussion_poll_votes_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "club_discussion_posts"; referencedColumns: ["id"] },
        ];
      };
      club_messages: {
        Row: {
          club_id: number;
          content: string;
          created_at: string;
          id: number;
          pair_high: string;
          pair_low: string;
          recipient_id: string;
          sender_id: string;
        };
        Insert: { club_id: number; recipient_id: string; content: string };
        Update: never;
        Relationships: [
          { foreignKeyName: "club_messages_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      club_message_reads: {
        Row: { club_id: number; id: number; pair_high: string; pair_low: string; profile_id: string; read_at: string };
        Insert: { club_id: number; pair_low: string; pair_high: string; read_at?: string };
        Update: { read_at?: string };
        Relationships: [];
      };
      club_loyalty_settings: {
        Row: {
          club_id: number; enabled: boolean; point_value: number | null;
          table_booking_price: string | null; milestones: Json; anniversaries: Json;
          tiers: Json; updated_at: string;
        };
        Insert: { club_id: number } & Partial<Database["public"]["Tables"]["club_loyalty_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["club_loyalty_settings"]["Row"]>;
        Relationships: [];
      };
      club_loyalty_transactions: {
        Row: {
          id: number; club_id: number; profile_id: string; kind: string; category: string;
          description: string; available_delta: number; lifetime_delta: number;
          money_amount: number | null; source_key: string; created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      club_rivals: {
        Row: { id: number; club_id: number; profile_id: string; rival_id: string; created_at: string };
        Insert: { club_id: number; rival_id: string };
        Update: never;
        Relationships: [];
      };
      club_merchandise_items: {
        Row: {
          id: number; club_id: number; legacy_id: string; name: string; category: string | null;
          description: string | null; image_src: string | null; image_alt: string | null;
          price: string | null; stock: number; minimum_tier_key: string | null;
          active: boolean; position: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      club_merchandise_orders: {
        Row: {
          id: number; club_id: number; profile_id: string; status: string; notes: string;
          membership_tier_key: string | null;
          membership_tier_label: string | null; created_at: string; status_updated_at: string;
          subtotal: number; tier_discount_percent: number; tier_discount_amount: number;
          loyalty_points_spent: number; loyalty_discount: number; total: number;
        };
        // Written by place_merchandise_order, which prices it.
        Insert: never;
        Update: { status?: string; status_updated_at?: string };
        Relationships: [];
      };
      club_merchandise_order_items: {
        Row: {
          id: number; order_id: number; item_id: number | null; name: string;
          price: string | null; quantity: number;
          unit_amount: number; discount_amount: number; line_total: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      club_merchandise_order_notes: {
        Row: {
          id: number; order_id: number; author_id: string | null;
          body: string; automatic: boolean; created_at: string;
        };
        Insert: { order_id: number; author_id: string; body: string };
        Update: never;
        Relationships: [];
      };
      club_coaching_settings: {
        Row: { club_id: number; enabled: boolean; intro_text: string | null; policy_text: string | null };
        Insert: { club_id: number; enabled?: boolean; intro_text?: string | null; policy_text?: string | null };
        Update: Partial<Database["public"]["Tables"]["club_coaching_settings"]["Row"]>;
        Relationships: [];
      };
      club_coaching_slots: {
        Row: {
          id: number; club_id: number; title: string; description: string | null;
          slot_date: string; start_time: string; end_time: string | null; price: string | null;
          coaching_type: string; capacity: number; status: string;
          created_by: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          club_id: number; title: string; slot_date: string; start_time: string;
          description?: string | null; end_time?: string | null; price?: string | null;
          coaching_type?: string; capacity?: number; status?: string; created_by?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["club_coaching_slots"]["Row"], "id" | "club_id">>;
        Relationships: [];
      };
      club_coaching_bookings: {
        Row: {
          id: number; slot_id: number; profile_id: string; status: string;
          payment_status: string; booked_at: string; paid_at: string | null;
          cancelled_at: string | null; cancelled_by: string | null;
        };
        Insert: { slot_id: number };
        Update: { status?: string; payment_status?: string };
        Relationships: [];
      };
      club_reviews: {
        Row: {
          author_legacy_id: number | null;
          author_name: string;
          author_profile_id: string | null;
          club_id: number;
          comment: string | null;
          created_at: string;
          flagged_at: string | null;
          flagged_by: string | null;
          flagged_by_name: string | null;
          id: number;
          rating: number;
          removed_at: string | null;
          removed_by: string | null;
          removed_by_name: string | null;
          updated_at: string;
        };
        // `id` is generated since 0018. The importer may still supply one.
        Insert: Partial<Omit<Database["public"]["Tables"]["club_reviews"]["Row"], "club_id" | "rating">> & {
          club_id: number;
          rating: number;
        };
        Update: Partial<Database["public"]["Tables"]["club_reviews"]["Row"]>;
        Relationships: [
          { foreignKeyName: "club_reviews_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
      formats: {
        Row: { id: number; label: string; slug: string };
        Insert: { label: string; slug: string };
        Update: Partial<{ label: string; slug: string }>;
        Relationships: [];
      };
      games: {
        Row: { id: number; label: string; slug: string };
        Insert: { label: string; slug: string };
        Update: Partial<{ label: string; slug: string }>;
        Relationships: [];
      };
      facilities: {
        Row: { id: number; label: string; slug: string };
        Insert: { label: string; slug: string };
        Update: Partial<{ label: string; slug: string }>;
        Relationships: [];
      };
      payment_methods: {
        Row: { id: number; label: string; slug: string };
        Insert: { label: string; slug: string };
        Update: Partial<{ label: string; slug: string }>;
        Relationships: [];
      };
      club_formats: {
        Row: { club_id: number; format_id: number };
        Insert: { club_id: number; format_id: number };
        Update: Partial<{ club_id: number; format_id: number }>;
        Relationships: [
          { foreignKeyName: "club_formats_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "club_formats_format_id_fkey"; columns: ["format_id"]; isOneToOne: false; referencedRelation: "formats"; referencedColumns: ["id"] },
        ];
      };
      club_games: {
        Row: { club_id: number; game_id: number };
        Insert: { club_id: number; game_id: number };
        Update: Partial<{ club_id: number; game_id: number }>;
        Relationships: [
          { foreignKeyName: "club_games_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "club_games_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "games"; referencedColumns: ["id"] },
        ];
      };
      club_facilities: {
        Row: { club_id: number; facility_id: number };
        Insert: { club_id: number; facility_id: number };
        Update: Partial<{ club_id: number; facility_id: number }>;
        Relationships: [
          { foreignKeyName: "club_facilities_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "club_facilities_facility_id_fkey"; columns: ["facility_id"]; isOneToOne: false; referencedRelation: "facilities"; referencedColumns: ["id"] },
        ];
      };
      club_payment_methods: {
        Row: { club_id: number; payment_method_id: number };
        Insert: { club_id: number; payment_method_id: number };
        Update: Partial<{ club_id: number; payment_method_id: number }>;
        Relationships: [
          { foreignKeyName: "club_payment_methods_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "club_payment_methods_payment_method_id_fkey"; columns: ["payment_method_id"]; isOneToOne: false; referencedRelation: "payment_methods"; referencedColumns: ["id"] },
        ];
      };
      club_booking_settings: {
        Row: {
          club_id: number;
          table_booking_price: number;
          price_currency: string;
          calendar_horizon_days: number;
          enforce_advance_window: boolean;
          cancel_cutoff_hours: number;
          waitlist_enabled: boolean;
          looking_for_games_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          club_id: number;
          table_booking_price?: number;
          price_currency?: string;
          calendar_horizon_days?: number;
          enforce_advance_window?: boolean;
          cancel_cutoff_hours?: number;
          waitlist_enabled?: boolean;
          looking_for_games_enabled?: boolean;
        };
        Update: Partial<{
          table_booking_price: number;
          price_currency: string;
          calendar_horizon_days: number;
          enforce_advance_window: boolean;
          cancel_cutoff_hours: number;
          waitlist_enabled: boolean;
          looking_for_games_enabled: boolean;
          updated_at: string;
        }>;
        Relationships: [];
      };
      club_bookings: {
        Row: {
          id: number;
          club_id: number;
          club_session_id: number;
          session_date: string;
          session_day: string;
          session_time: string;
          session_label: string;
          table_index: number;
          game_title: string;
          notes: string;
          booked_by: string;
          opponent_profile_id: string | null;
          opponent_name: string;
          accepted_by: string | null;
          accepted_at: string | null;
          source: string;
          status: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancel_reason: string | null;
          price_currency: string;
          base_price: number;
          tier_discount_percent: number;
          tier_discount_amount: number;
          loyalty_points_spent: number;
          loyalty_discount_amount: number;
          total_price: number;
          membership_tier_key: string | null;
          membership_tier_label: string;
          legacy_id: number | null;
          legacy_session_key: string | null;
          created_at: string;
          updated_at: string;
        };
        /** Only the columns a member is granted. Everything else is server-set. */
        Insert: {
          club_id: number;
          club_session_id: number;
          session_date: string;
          game_title: string;
          notes?: string;
          opponent_profile_id?: string | null;
          opponent_name?: string;
        };
        Update: Partial<{ status: string; cancel_reason: string | null }>;
        Relationships: [
          { foreignKeyName: "club_bookings_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
          { foreignKeyName: "club_bookings_booked_by_fkey"; columns: ["booked_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      club_booking_participants: {
        Row: {
          booking_id: number;
          profile_id: string;
          club_id: number;
          session_date: string;
          role: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      club_booking_waitlist: {
        Row: {
          id: number;
          club_id: number;
          club_session_id: number;
          session_date: string;
          session_day: string;
          session_time: string;
          session_label: string;
          game_title: string;
          notes: string;
          requested_by: string;
          opponent_profile_id: string | null;
          opponent_name: string;
          status: string;
          last_skip_reason: string | null;
          last_skipped_at: string | null;
          skip_count: number;
          promoted_at: string | null;
          booking_id: number | null;
          withdrawn_at: string | null;
          legacy_id: number | null;
          created_at: string;
        };
        Insert: {
          club_id: number;
          club_session_id: number;
          session_date: string;
          game_title: string;
          notes?: string;
          opponent_profile_id?: string | null;
          opponent_name?: string;
        };
        Update: Partial<{ status: string; withdrawn_at: string | null }>;
        Relationships: [];
      };
      club_looking_for_games: {
        Row: {
          id: number;
          club_id: number;
          club_session_id: number;
          session_date: string;
          session_day: string;
          session_time: string;
          session_label: string;
          game_title: string;
          notes: string;
          created_by: string;
          status: string;
          accepted_by: string | null;
          accepted_at: string | null;
          booking_id: number | null;
          legacy_id: number | null;
          created_at: string;
        };
        Insert: {
          club_id: number;
          club_session_id: number;
          session_date: string;
          game_title: string;
          notes?: string;
        };
        Update: Partial<{ status: string }>;
        Relationships: [];
      };
      club_event_cart_items: {
        Row: {
          id: number;
          event_id: number;
          ticket_type_id: number;
          profile_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { event_id: number; ticket_type_id: number; quantity?: number };
        Update: Partial<{ quantity: number; updated_at: string }>;
        Relationships: [];
      };
      club_event_bookings: {
        Row: {
          id: number;
          club_id: number;
          event_id: number;
          profile_id: string | null;
          full_name: string;
          email: string;
          reference: string;
          currency: string;
          subtotal: number;
          tier_discount_percent: number;
          tier_discount_amount: number;
          total: number;
          membership_tier_key: string | null;
          membership_tier_label: string;
          status: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          notes: string;
          legacy_id: number | null;
          created_at: string;
          updated_at: string;
        };
        /** Written only by checkout_event_cart. */
        Insert: never;
        Update: Partial<{ status: string }>;
        Relationships: [
          { foreignKeyName: "club_event_bookings_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "club_events"; referencedColumns: ["id"] },
        ];
      };
      club_event_booking_items: {
        Row: {
          id: number;
          booking_id: number;
          ticket_type_id: number;
          label: string;
          price: string;
          unit_amount: number;
          quantity: number;
        };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "club_event_booking_items_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: false; referencedRelation: "club_event_bookings"; referencedColumns: ["id"] },
        ];
      };
      club_discussion_categories: {
        Row: { club_id: number; id: number; label: string; position: number };
        Insert: { club_id: number; label: string; position?: number };
        Update: Partial<{ club_id: number; label: string; position: number }>;
        Relationships: [
          { foreignKeyName: "club_discussion_categories_club_id_fkey"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "clubs"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      can_manage_club: { Args: { target_club: number }; Returns: boolean };
      is_club_member: { Args: { target_club: number }; Returns: boolean };
      london_today: { Args: never; Returns: string };
      booking_discount_percent: { Args: { target_club: number; target_profile: string }; Returns: number };
      promote_waitlist_entry_as_manager: { Args: { entry_id: number }; Returns: number | null };
      accept_looking_for_game: { Args: { post_id: number }; Returns: number };
      tickets_taken: { Args: { target_type: number }; Returns: number };
      can_use_discussion_category: { Args: { target_club: number; category: string }; Returns: boolean };
      can_message_member: { Args: { target_club: number; other_person: string }; Returns: boolean };
      remove_discussion_post: { Args: { target: number }; Returns: number };
      remove_discussion_reply: { Args: { target: number }; Returns: number };
      sync_loyalty_anniversaries: { Args: { target_club: number; target_profile: string }; Returns: number };
      place_merchandise_order: {
        Args: { target_item: number; want: number; note?: string; redeem?: number };
        Returns: number;
      };
      member_tier: {
        Args: { target_club: number; target_profile: string };
        Returns: { tier_key: string; tier_label: string; tier_position: number; benefits: Json }[];
      };
      loyalty_wallet: {
        Args: { target_club: number; target_profile: string };
        Returns: { available: number; lifetime: number; entries: number }[];
      };
      checkout_event_cart: {
        Args: {
          target_event: number;
          buyer_name: string;
          buyer_email: string;
          booking_reference: string;
          discount_percent?: number;
          tier_key?: string | null;
          tier_label?: string;
        };
        Returns: number;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
