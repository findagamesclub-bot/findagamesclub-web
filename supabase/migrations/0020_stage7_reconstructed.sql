-- 0020 · Everything that existed only in the live database
--
-- Mostly Stage 7, plus three columns on `clubs` that were added by hand and
-- never written down either; they are called out where they appear.
--
-- This file was missing. Stage 7 (merchandise, loyalty, coaching, rivalries)
-- was applied straight to the live project and its migration was never
-- written, so `supabase/migrations/` jumped 0019 to 0021 and ten tables and
-- ten functions existed only in one database. Rebuilding from migrations gave
-- a schema the application could not run against, which is why the local
-- replay needed a hand-written stand-in.
--
-- Reconstructed from `supabase db dump --schema public` taken on 10 Sep 2026,
-- by taking every statement whose subject is one of the missing objects, then
-- removing the ones a later migration already creates. A dump is the state at
-- the end, not what this file originally did: 0027 hangs notification triggers
-- on three of these tables and 0038 re-indexes a fourth, and leaving those in
-- made 0020 refer to a function that does not exist for another seven files.
--
-- Two triggers here sit on tables earlier migrations already create, because
-- their functions belong to Stage 7:
--
--   clubs_haystack            on clubs             search_haystack, which the
--                                                  whole directory search reads
--   club_memberships_loyalty  on club_memberships  the join award
--
-- The SQL below is the dump's own, quoted identifiers and all, rather than
-- rewritten in the house style the other migrations use. That is deliberate:
-- this is a transcription of what is actually running, and retyping it to make
-- it prettier is a chance to change it. Anything built on these tables from
-- here on is written normally.
--
-- Verified by replaying 0001 to 0081 with this file in place and diffing the
-- resulting catalog against the dump.


-- ------------------------------------------------- columns added by hand
--
-- Not Stage 7, and not in any migration either: three columns on `clubs` that
-- only the live database has. `search_haystack` is the one that matters, since
-- the whole directory search reads it and the trigger further down is what
-- keeps it current. A rebuild without these accepts every club and finds none.

ALTER TABLE "public"."clubs"
  ADD COLUMN IF NOT EXISTS "legacy_created_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "owner_legacy_id" integer,
  ADD COLUMN IF NOT EXISTS "search_haystack" "text" DEFAULT ''::"text" NOT NULL;

CREATE INDEX IF NOT EXISTS "clubs_legacy_created_idx"
  ON "public"."clubs" USING "btree" ("legacy_created_at" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "clubs_owner_legacy_idx"
  ON "public"."clubs" USING "btree" ("owner_legacy_id") WHERE ("owner_legacy_id" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "clubs_search_haystack_trgm_idx"
  ON "public"."clubs" USING "gin" ("search_haystack" "extensions"."gin_trgm_ops");


-- ------------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS "public"."club_coaching_bookings" (
    "id" bigint NOT NULL,
    "slot_id" bigint NOT NULL,
    "profile_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "status" "text" DEFAULT 'booked'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "booked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    CONSTRAINT "club_coaching_bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text"]))),
    CONSTRAINT "club_coaching_bookings_status_check" CHECK (("status" = ANY (ARRAY['booked'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."club_coaching_settings" (
    "club_id" bigint NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "intro_text" "text",
    "policy_text" "text"
);

CREATE TABLE IF NOT EXISTS "public"."club_coaching_slots" (
    "club_id" bigint NOT NULL,
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "slot_date" "date" NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text",
    "price" "text",
    "coaching_type" "text" DEFAULT 'one-to-one'::"text" NOT NULL,
    "capacity" smallint DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_coaching_slots_capacity_check" CHECK ((("capacity" >= 1) AND ("capacity" <= 50))),
    CONSTRAINT "club_coaching_slots_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."club_loyalty_settings" (
    "club_id" bigint NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "point_value" numeric(10,4),
    "table_booking_price" "text",
    "milestones" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "anniversaries" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tiers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."club_loyalty_transactions" (
    "id" bigint NOT NULL,
    "club_id" bigint NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "available_delta" integer DEFAULT 0 NOT NULL,
    "lifetime_delta" integer DEFAULT 0 NOT NULL,
    "money_amount" numeric(10,2),
    "source_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_loyalty_transactions_kind_check" CHECK (("kind" = ANY (ARRAY['earned'::"text", 'spent'::"text", 'cancelled'::"text", 'refunded'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."club_merchandise_items" (
    "id" bigint NOT NULL,
    "club_id" bigint NOT NULL,
    "legacy_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "description" "text",
    "image_src" "text",
    "image_alt" "text",
    "price" "text",
    "stock" integer DEFAULT 0 NOT NULL,
    "minimum_tier_key" "text",
    "active" boolean DEFAULT true NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."club_merchandise_order_items" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "item_id" bigint,
    "name" "text" NOT NULL,
    "price" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "club_merchandise_order_items_quantity_check" CHECK ((("quantity" >= 1) AND ("quantity" <= 20)))
);

CREATE TABLE IF NOT EXISTS "public"."club_merchandise_order_notes" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "automatic" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_merchandise_order_notes_body" CHECK ((("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 2000)))
);

CREATE TABLE IF NOT EXISTS "public"."club_merchandise_orders" (
    "id" bigint NOT NULL,
    "club_id" bigint NOT NULL,
    "profile_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "status" "text" DEFAULT 'placed'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "membership_tier_key" "text",
    "membership_tier_label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status_updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "tier_discount_percent" smallint DEFAULT 0 NOT NULL,
    "tier_discount_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "loyalty_points_spent" integer DEFAULT 0 NOT NULL,
    "loyalty_discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "club_merchandise_orders_status_check" CHECK (("status" = ANY (ARRAY['placed'::"text", 'paid'::"text", 'fulfilled'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."club_rivals" (
    "id" bigint NOT NULL,
    "club_id" bigint NOT NULL,
    "profile_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "rival_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "club_rivals_not_self" CHECK (("profile_id" <> "rival_id"))
);

-- ----------------------------------------------------------------- identity

ALTER TABLE "public"."club_coaching_bookings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_coaching_bookings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."club_coaching_slots" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_coaching_slots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."club_loyalty_transactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_loyalty_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."club_merchandise_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_merchandise_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."club_merchandise_order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_merchandise_order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."club_merchandise_order_notes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_merchandise_order_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."club_merchandise_orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_merchandise_orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."club_rivals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."club_rivals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

-- -------------------------------------------------- primary keys and unique

ALTER TABLE ONLY "public"."club_coaching_bookings"
    ADD CONSTRAINT "club_coaching_bookings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."club_coaching_settings"
    ADD CONSTRAINT "club_coaching_settings_pkey" PRIMARY KEY ("club_id");

ALTER TABLE ONLY "public"."club_coaching_slots"
    ADD CONSTRAINT "club_coaching_slots_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."club_loyalty_settings"
    ADD CONSTRAINT "club_loyalty_settings_pkey" PRIMARY KEY ("club_id");

ALTER TABLE ONLY "public"."club_loyalty_transactions"
    ADD CONSTRAINT "club_loyalty_source_uniq" UNIQUE ("club_id", "source_key");

ALTER TABLE ONLY "public"."club_loyalty_transactions"
    ADD CONSTRAINT "club_loyalty_transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."club_merchandise_items"
    ADD CONSTRAINT "club_merchandise_items_key" UNIQUE ("club_id", "legacy_id");

ALTER TABLE ONLY "public"."club_merchandise_items"
    ADD CONSTRAINT "club_merchandise_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."club_merchandise_order_items"
    ADD CONSTRAINT "club_merchandise_order_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."club_merchandise_order_notes"
    ADD CONSTRAINT "club_merchandise_order_notes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."club_merchandise_orders"
    ADD CONSTRAINT "club_merchandise_orders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."club_rivals"
    ADD CONSTRAINT "club_rivals_once" UNIQUE ("club_id", "profile_id", "rival_id");

ALTER TABLE ONLY "public"."club_rivals"
    ADD CONSTRAINT "club_rivals_pkey" PRIMARY KEY ("id");

-- ------------------------------------------------------------------ indexes

CREATE UNIQUE INDEX "club_coaching_bookings_one_live" ON "public"."club_coaching_bookings" USING "btree" ("slot_id", "profile_id") WHERE ("status" = 'booked'::"text");

CREATE INDEX "club_coaching_bookings_slot_idx" ON "public"."club_coaching_bookings" USING "btree" ("slot_id") WHERE ("status" = 'booked'::"text");

CREATE INDEX "club_coaching_slots_club_idx" ON "public"."club_coaching_slots" USING "btree" ("club_id", "slot_date");

CREATE INDEX "club_loyalty_wallet_idx" ON "public"."club_loyalty_transactions" USING "btree" ("club_id", "profile_id", "created_at" DESC);

CREATE INDEX "club_merchandise_order_items_order_idx" ON "public"."club_merchandise_order_items" USING "btree" ("order_id");

CREATE INDEX "club_merchandise_order_notes_order_idx" ON "public"."club_merchandise_order_notes" USING "btree" ("order_id", "created_at");

CREATE INDEX "club_merchandise_orders_mine_idx" ON "public"."club_merchandise_orders" USING "btree" ("profile_id", "created_at" DESC);

CREATE INDEX "club_rivals_mine_idx" ON "public"."club_rivals" USING "btree" ("club_id", "profile_id");

-- ------------------------------------------------------------- foreign keys

ALTER TABLE ONLY "public"."club_coaching_bookings"
    ADD CONSTRAINT "club_coaching_bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."club_coaching_bookings"
    ADD CONSTRAINT "club_coaching_bookings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_coaching_bookings"
    ADD CONSTRAINT "club_coaching_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."club_coaching_slots"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_coaching_settings"
    ADD CONSTRAINT "club_coaching_settings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_coaching_slots"
    ADD CONSTRAINT "club_coaching_slots_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_coaching_slots"
    ADD CONSTRAINT "club_coaching_slots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."club_loyalty_settings"
    ADD CONSTRAINT "club_loyalty_settings_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_loyalty_transactions"
    ADD CONSTRAINT "club_loyalty_transactions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_loyalty_transactions"
    ADD CONSTRAINT "club_loyalty_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_merchandise_items"
    ADD CONSTRAINT "club_merchandise_items_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_merchandise_order_items"
    ADD CONSTRAINT "club_merchandise_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."club_merchandise_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."club_merchandise_order_items"
    ADD CONSTRAINT "club_merchandise_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."club_merchandise_orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_merchandise_order_notes"
    ADD CONSTRAINT "club_merchandise_order_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."club_merchandise_order_notes"
    ADD CONSTRAINT "club_merchandise_order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."club_merchandise_orders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_merchandise_orders"
    ADD CONSTRAINT "club_merchandise_orders_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_merchandise_orders"
    ADD CONSTRAINT "club_merchandise_orders_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_rivals"
    ADD CONSTRAINT "club_rivals_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_rivals"
    ADD CONSTRAINT "club_rivals_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."club_rivals"
    ADD CONSTRAINT "club_rivals_rival_id_fkey" FOREIGN KEY ("rival_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------- functions
--
-- After the tables: two of these are `language sql`, whose bodies are parsed
-- at creation, so they cannot be declared before what they read.

CREATE OR REPLACE FUNCTION "public"."club_coaching_bookings_before_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := (select auth.uid());
  end if;
  if new.payment_status = 'paid' and old.payment_status <> 'paid' then
    new.paid_at := now();
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."club_coaching_bookings_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  cap  smallint;
  used integer;
  slot public.club_coaching_slots%rowtype;
begin
  if new.status <> 'booked' then
    return new;
  end if;

  select * into slot from public.club_coaching_slots
   where id = new.slot_id for update;

  if slot.id is null then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'check_violation';
  end if;
  if slot.status <> 'open' then
    raise exception 'SLOT_CLOSED' using errcode = 'check_violation';
  end if;
  if slot.slot_date < public.london_today() then
    raise exception 'SLOT_PASSED' using errcode = 'check_violation';
  end if;
  if not public.is_club_member(slot.club_id) then
    raise exception 'MEMBERS_ONLY' using errcode = 'insufficient_privilege';
  end if;

  cap := slot.capacity;
  select count(*) into used from public.club_coaching_bookings
   where slot_id = new.slot_id and status = 'booked' and id <> coalesce(new.id, -1);

  if used >= cap then
    raise exception 'SLOT_FULL' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."club_memberships_award_loyalty"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  base integer;
begin
  if new.status <> 'approved' or coalesce(old.status, '') = 'approved' then
    return new;
  end if;

  select coalesce((s.milestones ->> 'membershipApproved')::integer, 0)
    into base
    from public.club_loyalty_settings s
   where s.club_id = new.club_id and s.enabled;

  if coalesce(base, 0) > 0 then
    perform public.award_loyalty(
      new.club_id, new.profile_id, 'membership-approved',
      'Membership approved', base,
      'membership:' || new.id || '::approved'
    );
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."club_merchandise_orders_log_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status is distinct from old.status then
    insert into public.club_merchandise_order_notes (order_id, author_id, body, automatic)
    values (new.id, (select auth.uid()), 'Marked ' || new.status, true);
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."club_merchandise_orders_on_cancel"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  line record;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then
    return new;
  end if;

  for line in
    select item_id, quantity from public.club_merchandise_order_items
     where order_id = new.id and item_id is not null
  loop
    update public.club_merchandise_items
       set stock = stock + line.quantity
     where id = line.item_id;
  end loop;

  -- Give back what they spent.
  if new.loyalty_points_spent > 0 then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, money_amount, source_key)
    values
      (new.club_id, new.profile_id, 'refunded', 'merchandise-order',
       'Points returned, order cancelled', new.loyalty_points_spent, 0,
       new.loyalty_discount, 'merch:' || new.id || '::refunded')
    on conflict (club_id, source_key) do nothing;
  end if;

  -- And take back what the order earned.
  if exists (
    select 1 from public.club_loyalty_transactions
     where club_id = new.club_id and source_key = 'merch:' || new.id
  ) then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, source_key)
    select new.club_id, new.profile_id, 'cancelled', 'merchandise-order',
           'Order cancelled', -t.available_delta, -t.lifetime_delta,
           'merch:' || new.id || '::cancelled'
      from public.club_loyalty_transactions t
     where t.club_id = new.club_id and t.source_key = 'merch:' || new.id
    on conflict (club_id, source_key) do nothing;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."clubs_refresh_haystack"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.search_haystack := lower(concat_ws(' ',
    new.name, new.city, new.neighbourhood, new.summary, new.description,
    new.venue_name, new.venue_address, new.venue_postcode,
    array_to_string(new.tags, ' '), array_to_string(new.accessibility, ' ')
  ));
  new.updated_at := now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."loyalty_wallet"("target_club" bigint, "target_profile" "uuid") RETURNS TABLE("available" integer, "lifetime" integer, "entries" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(available_delta), 0)::integer,
         coalesce(sum(lifetime_delta), 0)::integer,
         count(*)::integer
    from public.club_loyalty_transactions
   where club_id = target_club and profile_id = target_profile;
$$;

CREATE OR REPLACE FUNCTION "public"."member_tier"("target_club" bigint, "target_profile" "uuid") RETURNS TABLE("tier_key" "text", "tier_label" "text", "tier_position" smallint, "benefits" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select t.tier_key, t.label, t.position, t.benefits
    from public.club_memberships m
    join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = target_club and m.profile_id = target_profile
     and m.status = 'approved';
$$;

CREATE OR REPLACE FUNCTION "public"."place_merchandise_order"("target_item" bigint, "want" integer, "note" "text" DEFAULT ''::"text", "redeem" integer DEFAULT 0) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor      uuid := (select auth.uid());
  item       public.club_merchandise_items%rowtype;
  tier       record;
  need_pos   smallint;
  quantity   integer := greatest(1, least(20, coalesce(want, 1)));
  unit       numeric(10,2);
  pct        smallint;
  per_unit   numeric(10,2);
  gross      numeric(10,2);
  discount   numeric(10,2);
  net        numeric(10,2);
  cap_pct    smallint;
  point_val  numeric(10,4);
  have_pts   integer;
  use_pts    integer := greatest(0, coalesce(redeem, 0));
  pts_value  numeric(10,2) := 0;
  new_order  bigint;
  award      integer;
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  -- Locked before anything is checked, so the stock we read is the stock we
  -- decrement.
  select * into item from public.club_merchandise_items
   where id = target_item for update;

  if item.id is null or not item.active then
    raise exception 'ITEM_NOT_FOUND' using errcode = 'check_violation';
  end if;

  select * into tier from public.member_tier(item.club_id, actor);
  if tier.tier_key is null then
    raise exception 'MEMBERS_ONLY' using errcode = 'insufficient_privilege';
  end if;

  -- Legacy refuses outright when the tier does not carry merchandise access,
  -- separately from any minimum-tier field on the item itself.
  if coalesce((tier.benefits ->> 'merchandiseAccess')::boolean, false) is not true then
    raise exception 'NO_MERCH_ACCESS' using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(item.minimum_tier_key), '') <> '' then
    select t.position into need_pos from public.club_membership_tiers t
     where t.club_id = item.club_id and t.tier_key = item.minimum_tier_key;
    if need_pos is not null and tier.tier_position < need_pos then
      raise exception 'TIER_TOO_LOW' using errcode = 'insufficient_privilege';
    end if;
  end if;

  if item.stock <= 0 then
    raise exception 'SOLD_OUT' using errcode = 'check_violation';
  end if;
  if quantity > item.stock then
    raise exception 'NOT_ENOUGH_STOCK' using errcode = 'check_violation';
  end if;

  unit     := coalesce(public.money_amount(item.price), 0);
  pct      := greatest(0, least(100, coalesce((tier.benefits ->> 'merchandiseDiscountPercent')::smallint, 0)));
  per_unit := round(unit * pct / 100.0, 2);
  gross    := round(unit * quantity, 2);
  discount := round(per_unit * quantity, 2);
  net      := greatest(gross - discount, 0);

  -- Points come off what is left, capped by the tier's own percentage.
  if use_pts > 0 then
    cap_pct := greatest(0, least(100, coalesce((tier.benefits ->> 'loyaltyRedemptionCapPercent')::smallint, 0)));
    select s.point_value into point_val from public.club_loyalty_settings s
     where s.club_id = item.club_id and s.enabled;
    select coalesce(sum(available_delta), 0) into have_pts
      from public.club_loyalty_transactions
     where club_id = item.club_id and profile_id = actor;

    if point_val is null or point_val <= 0 or cap_pct = 0 then
      raise exception 'NO_REDEMPTION' using errcode = 'check_violation';
    end if;
    if use_pts > have_pts then
      raise exception 'NOT_ENOUGH_POINTS' using errcode = 'check_violation';
    end if;

    pts_value := round(use_pts * point_val, 2);
    if pts_value > round(net * cap_pct / 100.0, 2) then
      raise exception 'OVER_REDEMPTION_CAP' using errcode = 'check_violation';
    end if;
    net := greatest(net - pts_value, 0);
  else
    use_pts := 0;
  end if;

  update public.club_merchandise_items
     set stock = stock - quantity
   where id = item.id;

  insert into public.club_merchandise_orders
    (club_id, profile_id, notes, membership_tier_key, membership_tier_label,
     subtotal, tier_discount_percent, tier_discount_amount,
     loyalty_points_spent, loyalty_discount, total)
  values
    (item.club_id, actor, coalesce(btrim(note), ''), tier.tier_key, tier.tier_label,
     gross, pct, discount, use_pts, pts_value, net)
  returning id into new_order;

  insert into public.club_merchandise_order_items
    (order_id, item_id, name, price, quantity, unit_amount, discount_amount, line_total)
  values
    (new_order, item.id, item.name, item.price, quantity, unit, per_unit, round(net, 2));

  -- Spending moves the balance, never the lifetime total: paying with points
  -- must not cost somebody their rank.
  if use_pts > 0 then
    insert into public.club_loyalty_transactions
      (club_id, profile_id, kind, category, description,
       available_delta, lifetime_delta, money_amount, source_key)
    values
      (item.club_id, actor, 'spent', 'merchandise-order',
       'Points off ' || item.name, -use_pts, 0, pts_value,
       'merch:' || new_order || '::redeemed');
  end if;

  select coalesce((s.milestones ->> 'merchandisePurchase')::integer, 0) into award
    from public.club_loyalty_settings s
   where s.club_id = item.club_id and s.enabled;

  if coalesce(award, 0) > 0 then
    perform public.award_loyalty(
      item.club_id, actor, 'merchandise-order',
      'Ordered ' || item.name, award, 'merch:' || new_order, net);
  end if;

  return new_order;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."sync_loyalty_anniversaries"("target_club" bigint, "target_profile" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  m         record;
  milestone record;
  joined    date;
  due       date;
  paid      integer := 0;
begin
  select id, joined_at, created_at into m
    from public.club_memberships
   where club_id = target_club and profile_id = target_profile and status = 'approved'
   limit 1;

  if m.id is null then
    return 0;
  end if;

  joined := coalesce(m.joined_at, m.created_at)::date;
  if joined is null then
    return 0;
  end if;

  for milestone in
    select (value ->> 'years')::integer as years, (value ->> 'points')::integer as points
      from public.club_loyalty_settings s,
           lateral jsonb_array_elements(s.anniversaries)
     where s.club_id = target_club and s.enabled
  loop
    if milestone.years is null or milestone.years <= 0
       or milestone.points is null or milestone.points <= 0 then
      continue;
    end if;

    due := joined + (milestone.years || ' years')::interval;
    if due > public.london_today() then
      continue;
    end if;

    if public.award_loyalty(
         target_club, target_profile, 'anniversary',
         milestone.years || '-year membership anniversary',
         milestone.points,
         'membership:' || m.id || '::anniversary:' || milestone.years
       ) is not null then
      paid := paid + 1;
    end if;
  end loop;

  return paid;
end;
$$;

-- ----------------------------------------------------------------- triggers

CREATE OR REPLACE TRIGGER "club_coaching_bookings_capacity" BEFORE INSERT OR UPDATE ON "public"."club_coaching_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."club_coaching_bookings_guard"();

CREATE OR REPLACE TRIGGER "club_coaching_bookings_stamp" BEFORE UPDATE ON "public"."club_coaching_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."club_coaching_bookings_before_update"();

CREATE OR REPLACE TRIGGER "club_merchandise_orders_cancel" AFTER UPDATE OF "status" ON "public"."club_merchandise_orders" FOR EACH ROW EXECUTE FUNCTION "public"."club_merchandise_orders_on_cancel"();

CREATE OR REPLACE TRIGGER "club_merchandise_orders_status_log" AFTER UPDATE OF "status" ON "public"."club_merchandise_orders" FOR EACH ROW EXECUTE FUNCTION "public"."club_merchandise_orders_log_status"();

CREATE OR REPLACE TRIGGER "club_memberships_loyalty" AFTER INSERT OR UPDATE OF "status" ON "public"."club_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."club_memberships_award_loyalty"();

CREATE OR REPLACE TRIGGER "clubs_haystack" BEFORE INSERT OR UPDATE ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."clubs_refresh_haystack"();

-- --------------------------------------------------------- row level security

ALTER TABLE "public"."club_coaching_bookings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_coaching_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_coaching_slots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_loyalty_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_loyalty_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_merchandise_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_merchandise_order_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_merchandise_order_notes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_merchandise_orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."club_rivals" ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------- policies

CREATE POLICY "club_coaching_bookings_book" ON "public"."club_coaching_bookings" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));

CREATE POLICY "club_coaching_bookings_change" ON "public"."club_coaching_bookings" FOR UPDATE TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."club_coaching_slots" "s"
  WHERE (("s"."id" = "club_coaching_bookings"."slot_id") AND "public"."can_manage_club"("s"."club_id"))))));

CREATE POLICY "club_coaching_bookings_read" ON "public"."club_coaching_bookings" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."club_coaching_slots" "s"
  WHERE (("s"."id" = "club_coaching_bookings"."slot_id") AND "public"."can_manage_club"("s"."club_id"))))));

CREATE POLICY "club_coaching_settings_manage" ON "public"."club_coaching_settings" TO "authenticated" USING ("public"."can_manage_club"("club_id")) WITH CHECK ("public"."can_manage_club"("club_id"));

CREATE POLICY "club_coaching_settings_read" ON "public"."club_coaching_settings" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "club_coaching_slots_manage" ON "public"."club_coaching_slots" TO "authenticated" USING ("public"."can_manage_club"("club_id")) WITH CHECK ("public"."can_manage_club"("club_id"));

CREATE POLICY "club_coaching_slots_read" ON "public"."club_coaching_slots" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));

CREATE POLICY "club_loyalty_settings_read" ON "public"."club_loyalty_settings" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "club_loyalty_transactions_read" ON "public"."club_loyalty_transactions" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."can_manage_club"("club_id")));

CREATE POLICY "club_merchandise_items_read" ON "public"."club_merchandise_items" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "club_merchandise_order_items_read" ON "public"."club_merchandise_order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_merchandise_orders" "o"
  WHERE (("o"."id" = "club_merchandise_order_items"."order_id") AND (("o"."profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."can_manage_club"("o"."club_id"))))));

CREATE POLICY "club_merchandise_order_notes_add" ON "public"."club_merchandise_order_notes" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."club_merchandise_orders" "o"
  WHERE (("o"."id" = "club_merchandise_order_notes"."order_id") AND "public"."can_manage_club"("o"."club_id"))))));

CREATE POLICY "club_merchandise_order_notes_read" ON "public"."club_merchandise_order_notes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."club_merchandise_orders" "o"
  WHERE (("o"."id" = "club_merchandise_order_notes"."order_id") AND "public"."can_manage_club"("o"."club_id")))));

CREATE POLICY "club_merchandise_orders_manage" ON "public"."club_merchandise_orders" FOR UPDATE TO "authenticated" USING ("public"."can_manage_club"("club_id"));

CREATE POLICY "club_merchandise_orders_read" ON "public"."club_merchandise_orders" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."can_manage_club"("club_id")));

CREATE POLICY "club_rivals_add" ON "public"."club_rivals" FOR INSERT TO "authenticated" WITH CHECK ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."is_club_member"("club_id")));

CREATE POLICY "club_rivals_drop" ON "public"."club_rivals" FOR DELETE TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));

CREATE POLICY "club_rivals_read" ON "public"."club_rivals" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));

-- ------------------------------------------------------------------- grants

GRANT ALL ON FUNCTION "public"."club_coaching_bookings_before_update"() TO "anon";

GRANT ALL ON FUNCTION "public"."club_coaching_bookings_before_update"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."club_coaching_bookings_before_update"() TO "service_role";

GRANT ALL ON FUNCTION "public"."club_coaching_bookings_guard"() TO "anon";

GRANT ALL ON FUNCTION "public"."club_coaching_bookings_guard"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."club_coaching_bookings_guard"() TO "service_role";

GRANT ALL ON FUNCTION "public"."club_memberships_award_loyalty"() TO "anon";

GRANT ALL ON FUNCTION "public"."club_memberships_award_loyalty"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."club_memberships_award_loyalty"() TO "service_role";

GRANT ALL ON FUNCTION "public"."club_merchandise_orders_log_status"() TO "anon";

GRANT ALL ON FUNCTION "public"."club_merchandise_orders_log_status"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."club_merchandise_orders_log_status"() TO "service_role";

GRANT ALL ON FUNCTION "public"."club_merchandise_orders_on_cancel"() TO "anon";

GRANT ALL ON FUNCTION "public"."club_merchandise_orders_on_cancel"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."club_merchandise_orders_on_cancel"() TO "service_role";

GRANT ALL ON FUNCTION "public"."clubs_refresh_haystack"() TO "anon";

GRANT ALL ON FUNCTION "public"."clubs_refresh_haystack"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."clubs_refresh_haystack"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."loyalty_wallet"("target_club" bigint, "target_profile" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."loyalty_wallet"("target_club" bigint, "target_profile" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."loyalty_wallet"("target_club" bigint, "target_profile" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."member_tier"("target_club" bigint, "target_profile" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."member_tier"("target_club" bigint, "target_profile" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."member_tier"("target_club" bigint, "target_profile" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."place_merchandise_order"("target_item" bigint, "want" integer, "note" "text", "redeem" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."place_merchandise_order"("target_item" bigint, "want" integer, "note" "text", "redeem" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."place_merchandise_order"("target_item" bigint, "want" integer, "note" "text", "redeem" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."sync_loyalty_anniversaries"("target_club" bigint, "target_profile" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."sync_loyalty_anniversaries"("target_club" bigint, "target_profile" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."sync_loyalty_anniversaries"("target_club" bigint, "target_profile" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."club_coaching_bookings" TO "service_role";

GRANT SELECT ON TABLE "public"."club_coaching_bookings" TO "authenticated";

GRANT INSERT("slot_id") ON TABLE "public"."club_coaching_bookings" TO "authenticated";

GRANT UPDATE("status") ON TABLE "public"."club_coaching_bookings" TO "authenticated";

GRANT UPDATE("payment_status") ON TABLE "public"."club_coaching_bookings" TO "authenticated";

GRANT UPDATE("paid_at") ON TABLE "public"."club_coaching_bookings" TO "authenticated";

GRANT UPDATE("cancelled_at") ON TABLE "public"."club_coaching_bookings" TO "authenticated";

GRANT UPDATE("cancelled_by") ON TABLE "public"."club_coaching_bookings" TO "authenticated";

GRANT ALL ON TABLE "public"."club_coaching_settings" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."club_coaching_settings" TO "authenticated";

GRANT SELECT ON TABLE "public"."club_coaching_settings" TO "anon";

GRANT ALL ON TABLE "public"."club_coaching_slots" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."club_coaching_slots" TO "authenticated";

GRANT ALL ON TABLE "public"."club_loyalty_settings" TO "service_role";

GRANT SELECT ON TABLE "public"."club_loyalty_settings" TO "authenticated";

GRANT SELECT ON TABLE "public"."club_loyalty_settings" TO "anon";

GRANT ALL ON TABLE "public"."club_loyalty_transactions" TO "service_role";

GRANT SELECT ON TABLE "public"."club_loyalty_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."club_merchandise_items" TO "service_role";

GRANT SELECT ON TABLE "public"."club_merchandise_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."club_merchandise_items" TO "anon";

GRANT ALL ON TABLE "public"."club_merchandise_order_items" TO "service_role";

GRANT SELECT ON TABLE "public"."club_merchandise_order_items" TO "authenticated";

GRANT ALL ON TABLE "public"."club_merchandise_order_notes" TO "service_role";

GRANT SELECT ON TABLE "public"."club_merchandise_order_notes" TO "authenticated";

GRANT INSERT("order_id") ON TABLE "public"."club_merchandise_order_notes" TO "authenticated";

GRANT INSERT("author_id") ON TABLE "public"."club_merchandise_order_notes" TO "authenticated";

GRANT INSERT("body") ON TABLE "public"."club_merchandise_order_notes" TO "authenticated";

GRANT ALL ON TABLE "public"."club_merchandise_orders" TO "service_role";

GRANT SELECT ON TABLE "public"."club_merchandise_orders" TO "authenticated";

GRANT UPDATE("status") ON TABLE "public"."club_merchandise_orders" TO "authenticated";

GRANT UPDATE("status_updated_at") ON TABLE "public"."club_merchandise_orders" TO "authenticated";

GRANT ALL ON TABLE "public"."club_rivals" TO "service_role";

GRANT SELECT,DELETE ON TABLE "public"."club_rivals" TO "authenticated";

GRANT INSERT("club_id") ON TABLE "public"."club_rivals" TO "authenticated";

GRANT INSERT("rival_id") ON TABLE "public"."club_rivals" TO "authenticated";
