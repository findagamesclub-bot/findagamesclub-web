-- 0084 · Saving what a club plays, offers and takes
--
-- Formats, games, facilities and payment methods are four pairs of tables with
-- one shape: a vocabulary of (id, slug, label), and a link table of
-- (club_id, thing_id). All four are select-only for `authenticated`, which is
-- right and has to stay that way: the vocabulary is shared by every club, so a
-- club that could write it directly could rename "Warhammer 40,000" for
-- everybody.
--
-- So one definer function instead. It takes the labels the picker is holding,
-- finds or creates each one in the shared vocabulary, and replaces the club's
-- links with exactly that set. Replace rather than merge, because a format
-- taken off in the browser has to come off here too, which means the caller
-- must always send the whole list and never a partial one.
--
-- The search haystack is not refreshed here: it is built from columns on
-- `clubs` alone, and the directory matches these four through their own joins.

-- The slug rule, in SQL.
--
-- Transcribed from `scripts/export-legacy-data.py:28`, which minted every slug
-- in the vocabulary. It has to agree exactly or a club adding a format that
-- already exists gets a second row for it: lowercase, "&" spelled out, every
-- run of anything else becomes one hyphen, then trim the hyphens off the ends.

create or replace function public.slugify(p_value text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      replace(lower(btrim(coalesce(p_value, ''))), '&', ' and '),
      '[^a-z0-9]+', '-', 'g'),
    '-');
$$;

revoke all on function public.slugify(text) from public, anon;
grant execute on function public.slugify(text) to authenticated;


create or replace function public.save_club_taxonomy(
  p_club bigint,
  p_kind text,
  p_labels text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text[];
  written integer := 0;
begin
  if not public.club_can(p_club, 'listing.edit') then
    raise exception 'NOT_PERMITTED';
  end if;

  if p_kind not in ('formats', 'games', 'facilities', 'payment_methods') then
    raise exception 'UNKNOWN_TAXONOMY';
  end if;

  -- Trimmed, blanks dropped, and de-duplicated case-insensitively so a club
  -- adding "Warhammer" twice with different capitals gets one link, not a
  -- constraint violation.
  select coalesce(array_agg(distinct btrim(label) order by btrim(label)), array[]::text[])
    into cleaned
    from unnest(coalesce(p_labels, array[]::text[])) as label
   where btrim(label) <> '';

  if p_kind = 'formats' then
    insert into public.formats (slug, label)
    select public.slugify(l), l from unnest(cleaned) as l
    on conflict (slug) do nothing;

    delete from public.club_formats where club_id = p_club;
    insert into public.club_formats (club_id, format_id)
    select p_club, f.id from public.formats f where f.slug = any (
      select public.slugify(l) from unnest(cleaned) as l);

  elsif p_kind = 'games' then
    insert into public.games (slug, label)
    select public.slugify(l), l from unnest(cleaned) as l
    on conflict (slug) do nothing;

    delete from public.club_games where club_id = p_club;
    insert into public.club_games (club_id, game_id)
    select p_club, g.id from public.games g where g.slug = any (
      select public.slugify(l) from unnest(cleaned) as l);

  elsif p_kind = 'facilities' then
    insert into public.facilities (slug, label)
    select public.slugify(l), l from unnest(cleaned) as l
    on conflict (slug) do nothing;

    delete from public.club_facilities where club_id = p_club;
    insert into public.club_facilities (club_id, facility_id)
    select p_club, f.id from public.facilities f where f.slug = any (
      select public.slugify(l) from unnest(cleaned) as l);

  else
    insert into public.payment_methods (slug, label)
    select public.slugify(l), l from unnest(cleaned) as l
    on conflict (slug) do nothing;

    delete from public.club_payment_methods where club_id = p_club;
    insert into public.club_payment_methods (club_id, payment_method_id)
    select p_club, m.id from public.payment_methods m where m.slug = any (
      select public.slugify(l) from unnest(cleaned) as l);
  end if;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke all on function public.save_club_taxonomy(bigint, text, text[]) from public, anon;
grant execute on function public.save_club_taxonomy(bigint, text, text[]) to authenticated;
