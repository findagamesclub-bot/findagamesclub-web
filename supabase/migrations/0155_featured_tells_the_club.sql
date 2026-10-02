/**
 * A featured slot tells the club it is on one.
 *
 * 0113 built the slot, the price, the overlap guard and the homepage read, and
 * told nobody at all. An admin put a club on the front page and the owner found
 * out by visiting their own site; the slot then ended the same way. The client
 * found both in one sitting, which is the same miss 0109, 0110, 0124 and 0126
 * each closed somewhere else: **anything done to a club gets told, and the undo
 * is news as well.**
 *
 * Three kinds, not one, for the reason 0104, 0112 and 0126 each found the hard
 * way: `notify_person` de-duplicates on (profile, kind, entity_type, entity_id)
 * while a notice is unread, and all three of these carry the same slot row. One
 * kind would mean the ending quietly rewriting the booking notice in place, so
 * the count never moves and from the owner's side nothing has happened.
 *
 * The bell is a trigger and the email is TypeScript, which is the split the
 * whole codebase uses. Nothing in SQL has ever sent an email, and booking a
 * slot happens from the admin screen today and may happen from a payment path
 * later; a notice that fires on one route is worse than none.
 *
 * The ending is neither, because nothing happens at the moment a date passes.
 * That is 0113's design and it is the right one ("a slot ends on its own, so
 * nobody has to remember to take it down"), but the cost is that somebody has
 * to ask. The daily listing-billing job asks, and `ended_notice_at` is what
 * stops a job that runs twice writing twice.
 *
 * Checked on a throwaway Postgres built from every migration
 * (`scripts/pg-harness.sh build`) with `supabase/tests/stage12-featured.sql`:
 * booking tells the owner, an admin who owns the club is told nothing, removing
 * a live slot tells them, removing one that already finished does not, the
 * ending writes exactly one notice, and a second run of the job writes none.
 */

alter table public.featured_listings
  add column if not exists ended_notice_at timestamptz;

comment on column public.featured_listings.ended_notice_at is
  'When the owner was told the slot had finished. Null means the job has not reached it yet.';

-- Everything that already ended is stamped as told, because nobody is owed a
-- letter about a slot that finished before this file existed. Without it the
-- first run of the job writes to every club that has ever been featured, which
-- is a worse first impression of the feature than the silence it replaces.
update public.featured_listings
   set ended_notice_at = now()
 where ends_on < public.london_today()
   and ended_notice_at is null;

-- The slots whose end has not been announced, which is the index the nightly
-- job reads. Partial, because an announced slot is never a candidate again.
create index if not exists featured_listings_unannounced_idx
  on public.featured_listings (ends_on)
  where ended_notice_at is null;

/**
 * Booked, and taken down early.
 *
 * A removal that lands on a slot which had already finished is housekeeping and
 * says nothing: the owner was told it ended when it ended, and telling them
 * again because an admin tidied the list would be the site inventing news.
 */
create or replace function public.featured_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    bigint;
  v_club  bigint;
  v_from  date;
  v_to    date;
  v_owner uuid;
  v_name  text;
  v_slug  text;
begin
  -- NEW is unassigned in a delete trigger and reading it raises, so the two
  -- cases are pulled apart before anything else happens.
  if tg_op = 'DELETE' then
    v_id := old.id; v_club := old.club_id;
    v_from := old.starts_on; v_to := old.ends_on;
  else
    v_id := new.id; v_club := new.club_id;
    v_from := new.starts_on; v_to := new.ends_on;
  end if;

  select c.owner_id, coalesce(c.name, ''), coalesce(c.slug, '')
    into v_owner, v_name, v_slug
    from public.clubs c
   where c.id = v_club;

  -- An unclaimed listing has nobody to tell, and nobody is told about their own
  -- doing: a site admin may own a club.
  if v_owner is null or v_owner = auth.uid() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.notify_person(
      v_owner,
      'featured-booked',
      v_name || ' is going on the front page',
      'Featured from ' || to_char(v_from, 'FMDD Mon YYYY')
        || ' to ' || to_char(v_to, 'FMDD Mon YYYY') || '.',
      '/clubs/' || v_slug,
      'featured_listings',
      v_id::text);
    return new;
  end if;

  if v_to >= public.london_today() then
    perform public.notify_person(
      v_owner,
      'featured-removed',
      v_name || ' has come off the front page',
      'The featured slot was taken down before it was due to end on '
        || to_char(v_to, 'FMDD Mon YYYY') || '.',
      '/clubs/' || v_slug,
      'featured_listings',
      v_id::text);
  end if;
  return old;
end;
$$;

revoke all on function public.featured_notify() from public, anon, authenticated;

drop trigger if exists featured_listings_notify on public.featured_listings;
create trigger featured_listings_notify
  after insert or delete on public.featured_listings
  for each row execute function public.featured_notify();

/**
 * Which slots have finished without anybody being told.
 *
 * A club with no owner is deliberately still returned, so the job can stamp it
 * and stop looking at it. Filtering it out here would leave it as a candidate
 * every night for ever.
 */
create or replace function public.featured_slots_just_ended()
returns table (
  slot_id bigint, club_id bigint, owner_id uuid, club_name text,
  club_slug text, starts_on date, ends_on date, price_pence integer
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.club_id, c.owner_id,
         coalesce(c.name, ''), coalesce(c.slug, ''),
         f.starts_on, f.ends_on, f.price_pence
    from public.featured_listings f
    join public.clubs c on c.id = f.club_id
   where f.ends_on < public.london_today()
     and f.ended_notice_at is null
   order by f.ends_on, f.id
$$;

revoke all on function public.featured_slots_just_ended()
  from public, anon, authenticated;

/**
 * Stamp one finished slot and ring the bell for it.
 *
 * The stamp and the notice are one statement apart in one transaction, so a job
 * that dies halfway has either done both for a slot or neither. False means
 * somebody else got there first, which is what makes running the job twice in a
 * day harmless rather than a second letter.
 */
create or replace function public.mark_featured_announced(p_slot bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_name  text;
  v_slug  text;
  v_from  date;
  v_to    date;
begin
  update public.featured_listings f
     set ended_notice_at = now()
   where f.id = p_slot
     and f.ended_notice_at is null
  returning f.starts_on, f.ends_on into v_from, v_to;

  if not found then
    return false;
  end if;

  select c.owner_id, coalesce(c.name, ''), coalesce(c.slug, '')
    into v_owner, v_name, v_slug
    from public.featured_listings f
    join public.clubs c on c.id = f.club_id
   where f.id = p_slot;

  -- Stamped either way, so an unclaimed listing stops being asked about.
  if v_owner is null then
    return true;
  end if;

  perform public.notify_person(
    v_owner,
    'featured-ended',
    v_name || ' has come off the front page',
    'The featured slot ran from ' || to_char(v_from, 'FMDD Mon YYYY')
      || ' to ' || to_char(v_to, 'FMDD Mon YYYY') || '. Book another any time.',
    '/clubs/' || v_slug,
    'featured_listings',
    p_slot::text);
  return true;
end;
$$;

revoke all on function public.mark_featured_announced(bigint)
  from public, anon, authenticated;
