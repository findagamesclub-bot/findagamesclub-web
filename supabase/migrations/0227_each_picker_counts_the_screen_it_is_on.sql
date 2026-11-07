-- 0227 · each picker counts the screen it is on
--
-- 0226's pickers counted every slot on the site. Found by opening them: with
-- the month set to Sep 2026 the club picker read "Didcot Wargames (3)" and
-- picking it drew one, and Dec 2026 plus Critical Stack offered "(1)" over a
-- page saying "No slot matches that" — a screen contradicting itself in two
-- places at once.
--
-- This is 0214 point iii again, which is the fifth screen where two figures
-- have had to be made to agree: "the counts belonged to a different question
-- from the screen they were on". The client counts figures against each other,
-- which is how all five were found.
--
-- THE RULE, the same one the tab counts already follow: a control narrows by
-- every axis except the one it labels. So the months are counted under the
-- search, the when and the club, the clubs are counted under the search, the
-- when and the month, and `live` is counted under nothing at all, because it
-- is the Slots tab's own label and must not move when somebody types.
--
-- A new parameter makes a NEW function in Postgres rather than replacing the
-- old one. Tenth time, after 0136, 0165, 0171, 0178, 0186, 0187, 0188, 0213
-- and 0214: a caller that forgets the arguments would keep resolving to the
-- no-argument version and go on counting the wrong question, which is this
-- bug again wearing a different hat.

begin;

drop function if exists public.admin_featured_facets();

create or replace function public.admin_featured_facets(
  p_when  text default '',
  p_query text default '',
  p_month text default '',
  p_club  bigint default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_needle text := nullif(btrim(coalesce(p_query, '')), '');
  v_month  text := nullif(btrim(coalesce(p_month, '')), '');
  v_today  date := public.london_today();
  v_when   text := case when coalesce(p_when, '') in ('live', 'soon', 'finished')
                        then p_when else '' end;
  v_months jsonb;
  v_clubs  jsonb;
  v_live   int;
begin
  if not public.is_admin() then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- The months, under everything except the month.
  select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'slots', m.slots)
                            order by m.month desc), '[]'::jsonb)
    into v_months
    from (select to_char(d.day, 'YYYY-MM') as month, count(*)::int as slots
            from public.featured_listings f
            left join public.clubs c on c.id = f.club_id
            cross join lateral generate_series(
              date_trunc('month', f.starts_on), date_trunc('month', f.ends_on),
              interval '1 month') as d(day)
           where (p_club is null or f.club_id = p_club)
             and (v_when = ''
                  or (v_when = 'live' and f.starts_on <= v_today and f.ends_on >= v_today)
                  or (v_when = 'soon' and f.starts_on > v_today)
                  or (v_when = 'finished' and f.ends_on < v_today))
             and (v_needle is null
                  or c.name ilike '%' || v_needle || '%'
                  or c.city ilike '%' || v_needle || '%'
                  or f.note ilike '%' || v_needle || '%'
                  or f.payment_note ilike '%' || v_needle || '%')
           group by 1) m;

  -- The clubs, under everything except the club.
  select coalesce(jsonb_agg(jsonb_build_object(
                    'id', k.club_id, 'name', k.name, 'slots', k.slots)
                            order by lower(k.name)), '[]'::jsonb)
    into v_clubs
    from (select f.club_id, coalesce(c.name, 'A club that has gone') as name,
                 count(*)::int as slots
            from public.featured_listings f
            left join public.clubs c on c.id = f.club_id
           where (v_month is null
                  or to_char(f.starts_on, 'YYYY-MM') <= v_month
                     and to_char(f.ends_on, 'YYYY-MM') >= v_month)
             and (v_when = ''
                  or (v_when = 'live' and f.starts_on <= v_today and f.ends_on >= v_today)
                  or (v_when = 'soon' and f.starts_on > v_today)
                  or (v_when = 'finished' and f.ends_on < v_today))
             and (v_needle is null
                  or c.name ilike '%' || v_needle || '%'
                  or c.city ilike '%' || v_needle || '%'
                  or f.note ilike '%' || v_needle || '%'
                  or f.payment_note ilike '%' || v_needle || '%')
           group by f.club_id, c.name) k;

  -- And the headline, under nothing: "Slots 2" means two clubs are on the
  -- front page as we speak, whatever the reader has typed underneath it.
  select count(*)::int into v_live
    from public.featured_listings f
   where f.starts_on <= v_today and f.ends_on >= v_today;

  return jsonb_build_object('months', v_months, 'clubs', v_clubs,
                            'live', coalesce(v_live, 0));
end;
$$;

revoke all on function public.admin_featured_facets(text, text, text, bigint)
  from public, anon;
grant execute on function public.admin_featured_facets(text, text, text, bigint)
  to authenticated;

commit;
