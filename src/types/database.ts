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
      club_reviews: {
        Row: {
          author_legacy_id: number | null;
          author_name: string;
          author_profile_id: string | null;
          club_id: number;
          comment: string | null;
          created_at: string;
          flagged_at: string | null;
          flagged_by_name: string | null;
          id: number;
          rating: number;
          removed_at: string | null;
          removed_by_name: string | null;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["club_reviews"]["Row"], "id" | "club_id" | "rating">> & {
          id: number;
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
    Functions: { is_admin: { Args: never; Returns: boolean } };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
