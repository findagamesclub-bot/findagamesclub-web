-- 0226 · the featured slots narrow down.
--
-- Section 2 is the break test: these three functions are `security definer`
-- and hand back EVERY featured slot on the site with its payment note. Nothing
-- but `is_admin()` stands in front of that, so if the guard ever goes, a club
-- owner reads what every other club was charged and what we wrote beside it.
--
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage7-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

insert into public.clubs (slug, name, city, status, owner_id)
values ('other-featured', 'Other Featured Club', 'York', 'active',
        'd0000000-0000-0000-0000-000000000001');

create temp table o as select id from public.clubs where slug = 'other-featured';
grant select on o to authenticated;

-- October, unpaid and priced: work to do.
insert into public.featured_listings (club_id, starts_on, ends_on, price_pence, note)
  select id, date '2026-10-01', date '2026-10-31', 2000, 'October homepage' from c;
-- November, settled.
insert into public.featured_listings
  (club_id, starts_on, ends_on, price_pence, note, paid_at, payment_method, payment_note)
  select id, date '2026-11-01', date '2026-11-30', 2000, 'November homepage',
         now(), 'Bank transfer', 'Invoice 55' from c;
-- A slot at the OTHER club that runs straight through November without
-- starting or ending in it. A month filter that reads `starts_on` alone
-- loses this one, and losing it is the whole reason the filter exists.
insert into public.featured_listings (club_id, starts_on, ends_on, price_pence, note)
  select id, date '2026-10-15', date '2026-12-15', 3000, 'Autumn run' from o;
-- September, given away. Nothing to settle, so it is in neither money tab.
insert into public.featured_listings (club_id, starts_on, ends_on, price_pence, note)
  select id, date '2026-09-01', date '2026-09-30', 0, 'Comped' from c;

do $$
declare
  v_n     int;
  v_total bigint;
  v_counts jsonb;
  v_note  text;
  v_first bigint;
  v_club  bigint;
  v_other bigint;
  v_said  text;
begin
  select id into v_club from c;
  select id into v_other from o;

  -- ====================================================================== 1
  -- An admin reads the whole book, and the count beside it is the whole book
  -- rather than the size of the page.
  -- ====================================================================== 1
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*), max(s.total_rows) into v_n, v_total
    from public.admin_featured_slots('', '', '', '', null, 'newest', 1, 25) s;
  reset role;

  if v_n <> 4 or v_total <> 4 then
    raise exception 'FAIL 1: an admin read % slots of % total', v_n, v_total;
  end if;
  raise notice 'PASS 1: an admin reads every slot, with the whole count beside it';

  -- ====================================================================== 2
  -- BREAK TEST. Nobody else reads any of it. A club owner is the one to try:
  -- they have a real reason to be curious and `featured_payment_standing`
  -- deliberately lets them read THEIR OWN slot, so "a club may see a payment"
  -- is already true somewhere and must not become true here.
  -- ====================================================================== 2
  v_said := '';
  begin
    set local role authenticated;
    perform pg_temp.be((select owner from who));
    select count(*) into v_n
      from public.admin_featured_slots('', '', '', '', null, 'newest', 1, 25) s;
    reset role;
    raise exception
      'FAIL 2: a club owner read % rows of the site''s featured book', v_n;
  exception when insufficient_privilege then
    reset role;
    v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 2: the guard did not refuse a club owner';
  end if;

  v_said := '';
  begin
    set local role authenticated;
    perform pg_temp.be((select stranger from who));
    select public.admin_featured_counts('', '', '', null) into v_counts;
    reset role;
    raise exception 'FAIL 2: a stranger read the counts: %', v_counts;
  exception when insufficient_privilege then
    reset role;
    v_said := 'refused';
  end;
  if v_said <> 'refused' then
    raise exception 'FAIL 2: the counts did not refuse a stranger';
  end if;
  raise notice 'PASS 2: break test — a club owner and a stranger read none of it';

  -- ====================================================================== 3
  -- Paid against unpaid, which is the client's first axis. A comped slot is
  -- in neither: there is nothing to chase and nothing was taken.
  -- ====================================================================== 3
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*) into v_n
    from public.admin_featured_slots('topay', '', '', '', null, 'newest', 1, 25) s;
  reset role;
  if v_n <> 2 then
    raise exception 'FAIL 3: "to pay" held % slots, expected the two priced unpaid ones', v_n;
  end if;

  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*), min(s.payment_note) into v_n, v_note
    from public.admin_featured_slots('paid', '', '', '', null, 'newest', 1, 25) s;
  reset role;
  if v_n <> 1 or coalesce(v_note, '') <> 'Invoice 55' then
    raise exception 'FAIL 3: "paid" held % slots and the note read "%"', v_n, v_note;
  end if;
  raise notice 'PASS 3: paid and unpaid split, and a comped slot is in neither';

  -- ====================================================================== 4
  -- A month holds the slots that RUN in it, not the ones that start in it.
  -- The Autumn run neither begins nor ends in November and is on the homepage
  -- every day of it.
  -- ====================================================================== 4
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*) into v_n
    from public.admin_featured_slots('', '', '', '2026-11', null, 'newest', 1, 25) s;
  reset role;
  if v_n <> 2 then
    raise exception
      'FAIL 4: November held % slots — a slot running through the month was lost', v_n;
  end if;
  raise notice 'PASS 4: a month holds what ran in it, spans included';

  -- ====================================================================== 5
  -- And a club, which is the third axis.
  -- ====================================================================== 5
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*) into v_n
    from public.admin_featured_slots('', '', '', '', v_other, 'newest', 1, 25) s;
  reset role;
  if v_n <> 1 then
    raise exception 'FAIL 5: the other club held % slots', v_n;
  end if;

  -- The search reaches the note, which is what an admin remembers about a slot
  -- months later.
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*) into v_n
    from public.admin_featured_slots('', '', 'autumn', '', null, 'newest', 1, 25) s;
  reset role;
  if v_n <> 1 then
    raise exception 'FAIL 5: searching the note found % slots', v_n;
  end if;
  raise notice 'PASS 5: a club and a search narrow it the same way';

  -- ====================================================================== 6
  -- The counts narrow with the filters they sit under, and NOT with the tab
  -- they label. "To pay 1" beside November has to mean one of what is on
  -- screen. 0119 made the same point about two sides of a rate.
  -- ====================================================================== 6
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select public.admin_featured_counts('', '', '2026-11', null) into v_counts;
  reset role;

  if (v_counts ->> 'all')::int <> 2
     or (v_counts ->> 'topay')::int <> 1
     or (v_counts ->> 'paid')::int <> 1 then
    raise exception 'FAIL 6: November counted %', v_counts;
  end if;
  raise notice 'PASS 6: the counts narrow with the month and not with the tab';

  -- ====================================================================== 7
  -- Paging, and a tie-break pointing the same way as its sort. Two slots
  -- booked for the same day is what 0130 paid for: "oldest first" handed back
  -- the newest of them.
  -- ====================================================================== 7
  insert into public.featured_listings (club_id, starts_on, ends_on, price_pence, note)
    values (v_club, date '2026-09-01', date '2026-09-30', 1000, 'Second September');

  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*), max(s.total_rows) into v_n, v_total
    from public.admin_featured_slots('', '', '', '', null, 'newest', 2, 2) s;
  reset role;
  if v_n <> 2 or v_total <> 5 then
    raise exception 'FAIL 7: page two held % of % rows', v_n, v_total;
  end if;

  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select s.id, s.note into v_first, v_note
    from public.admin_featured_slots('', '', '', '', null, 'oldest', 1, 1) s;
  reset role;
  if coalesce(v_note, '') <> 'Comped' then
    raise exception
      'FAIL 7: oldest-first handed back "%" — the tie-break runs against the sort',
      v_note;
  end if;
  raise notice 'PASS 7: it pages, and a tie-break points the way its sort does';

  -- A state this function has never heard of reads as "all", the same way an
  -- unrecognised sort reads as newest. A bookmark from a renamed tab is a
  -- full list, not an empty screen somebody reads as a broken filter.
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*) into v_n
    from public.admin_featured_slots('banana', '', '', '', null, 'newest', 1, 25) s;
  reset role;
  if v_n <> 5 then
    raise exception 'FAIL 7: an unknown state answered % rows rather than all 5', v_n;
  end if;
  raise notice 'PASS 7b: a state it has never heard of reads as all of them';

  -- ====================================================================== 8
  -- The month picker offers only months a slot really runs in, so a filter
  -- chosen from it can never answer nothing. Same rule `club_booking_facets`
  -- follows.
  -- ====================================================================== 8
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select public.admin_featured_facets('', '', '', null) into v_counts;
  reset role;

  -- Sep, Oct, Nov, Dec: the Autumn run puts a slot in all three of its months.
  if jsonb_array_length(v_counts -> 'months') <> 4 then
    raise exception 'FAIL 8: the picker offered % months, expected Sep to Dec',
      jsonb_array_length(v_counts -> 'months');
  end if;
  if (select (m ->> 'slots')::int from jsonb_array_elements(v_counts -> 'months') m
       where m ->> 'month' = '2026-11') <> 2 then
    raise exception 'FAIL 8: the picker counted November as %', v_counts -> 'months';
  end if;
  -- And both clubs, each with its own tally, so a club with one slot is
  -- offerable and a club with none is not.
  if jsonb_array_length(v_counts -> 'clubs') <> 2 then
    raise exception 'FAIL 8: the club picker offered %', v_counts -> 'clubs';
  end if;
  raise notice 'PASS 8: the pickers offer only months and clubs with something in them';

  -- The tab's own label, which must not narrow with the filters under it.
  -- Two are on the homepage today: this club's November week and the other
  -- club's Autumn run, which spans it. The month and club filters set above
  -- are deliberately not applied to this figure.
  if (v_counts ->> 'live')::int <> 2 then
    raise exception 'FAIL 8: the live figure read % rather than 2', v_counts ->> 'live';
  end if;
  raise notice 'PASS 8b: and the live figure counts what is on the homepage now';

  -- ====================================================================== 9
  -- The money and the calendar are two axes, and the row that proves it is a
  -- slot running TODAY that nobody has paid for: the single most interesting
  -- row on this screen. Folded into one filter, picking either word would
  -- have hidden it.
  -- ====================================================================== 9
  insert into public.featured_listings (club_id, starts_on, ends_on, price_pence, note)
    values (v_club, public.london_today() - 2, public.london_today() + 2, 2500,
            'On the homepage and unpaid');

  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*) into v_n
    from public.admin_featured_slots('topay', 'live', '', '', v_club, 'newest', 1, 25) s;
  reset role;
  if v_n <> 1 then
    raise exception
      'FAIL 9: "to pay" and "running now" together found % slots, expected the one', v_n;
  end if;

  -- Running now on its own still holds it, alongside the settled November
  -- slot, which is what "independent" means: dropping the money filter widens
  -- the list rather than changing the subject.
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select count(*) into v_n
    from public.admin_featured_slots('', 'live', '', '', v_club, 'newest', 1, 25) s;
  reset role;
  if v_n <> 2 then
    raise exception 'FAIL 9: "running now" at this club found % slots, expected 2', v_n;
  end if;

  -- And the counts beside the tabs narrow with it, because the tabs are the
  -- money axis and "when" is not the axis they label.
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  select public.admin_featured_counts('live', '', '', v_club) into v_counts;
  reset role;
  if (v_counts ->> 'all')::int <> 2 or (v_counts ->> 'topay')::int <> 1
     or (v_counts ->> 'paid')::int <> 1 then
    raise exception 'FAIL 9: running now counted %', v_counts;
  end if;
  raise notice 'PASS 9: the money and the calendar narrow independently';

  -- ===================================================================== 10
  -- BREAK TEST. Each picker counts the screen it is on, narrowed by every
  -- axis except the one it labels. 0226 counted the whole site, so with a
  -- month set the club picker said "(3)" and picking it drew one, and some
  -- pairs offered a count over a page drawing nothing. 0214 point iii is the
  -- same bug on the bookings screen, and the client found both by counting
  -- the figures against each other.
  -- ===================================================================== 10
  set local role authenticated;
  perform pg_temp.be((select admin from who));
  -- The other club holds one slot, 15 Oct to 15 Dec. Three months, not the
  -- four the site has: it has nothing in September.
  select public.admin_featured_facets('', '', '', v_other) into v_counts;
  reset role;
  if jsonb_array_length(v_counts -> 'months') <> 3 then
    raise exception
      'FAIL 10: with one club picked the months read % — the picker is still '
      'counting the whole site', v_counts -> 'months';
  end if;

  set local role authenticated;
  perform pg_temp.be((select admin from who));
  -- And September belongs to this club alone, so the club picker holds one.
  select public.admin_featured_facets('', '', '2026-09', null) into v_counts;
  reset role;
  if jsonb_array_length(v_counts -> 'clubs') <> 1 then
    raise exception
      'FAIL 10: with September picked the clubs read % — a club with nothing '
      'in that month is still being offered', v_counts -> 'clubs';
  end if;

  -- The headline is the one figure that must NOT move, because it labels the
  -- tab rather than the list. Three are on the homepage by now (section 9
  -- added one), and September is long over, so a figure that narrowed with
  -- the month would read nought.
  if (v_counts ->> 'live')::int <> 3 then
    raise exception
      'FAIL 10: the live figure narrowed to % with a month picked',
      v_counts ->> 'live';
  end if;
  raise notice 'PASS 10: break test — each picker counts the screen it is on';

  raise notice 'ALL PASS · 0226 the featured slots narrow down';
end $$;

rollback;
