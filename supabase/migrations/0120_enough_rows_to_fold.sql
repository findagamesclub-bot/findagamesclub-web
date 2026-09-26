/**
 * 0120 · "Warhammer 40k 3" and "Warhammer 40,000 2", side by side
 *
 * Members type the game into their own booking, so one system arrives under
 * several spellings. The page folds them with `canonicalGame`, which reads
 * `src/utils/canonical-labels.json` — a file SQL cannot see, and one the import
 * script already shares, so the synonyms stay in one place rather than two that
 * drift.
 *
 * Folding after the count means the trim has to happen after the fold, and this
 * function was trimming to five before anything folded: two spellings of one
 * game spent two of the five slots and the sixth game fell off the list for a
 * duplicate. It returns twelve now and the page shows five.
 *
 * Same reasoning for the nights themselves, where a club that renamed a session
 * mid-season has two labels for one night.
 *
 * Behaviour-tested on scripts/pg-harness.sh: six rows folding to four still
 * shows four, and the row that used to fall off the end is on the list.
 */

create or replace function public.club_analytics_nights(
  p_club bigint, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.analytics_allowed(p_club);
  return (
  select jsonb_build_object(
    'nights', coalesce((
      select jsonb_agg(row_to_json(n) order by n.bookings desc, n.label)
        from (
          select coalesce(nullif(b.session_label, ''), b.session_day, 'A night') as label,
                 count(*) as bookings
            from public.club_bookings b
           where b.club_id = p_club and b.status <> 'cancelled'
             and b.session_date between p_from and p_to
           group by 1 order by 2 desc limit 12
        ) n), '[]'::jsonb),
    'weekdays', coalesce((
      select jsonb_agg(row_to_json(d) order by d.position)
        from (
          select to_char(b.session_date, 'Dy') as label,
                 extract(isodow from b.session_date)::int as position,
                 count(*) as bookings
            from public.club_bookings b
           where b.club_id = p_club and b.status <> 'cancelled'
             and b.session_date between p_from and p_to
           group by 1, 2 order by 2
        ) d), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(row_to_json(g) order by g.played desc, g.label)
        from (
          select coalesce(nullif(btrim(b.game_title), ''), 'Not said') as label,
                 count(*) as played
            from public.club_bookings b
           where b.club_id = p_club and b.status <> 'cancelled'
             and b.session_date between p_from and p_to
           group by 1 order by 2 desc limit 12
        ) g), '[]'::jsonb),
    -- Against the places the club actually put on sale, not against what sold.
    'sellThrough', coalesce((
      select jsonb_agg(row_to_json(s) order by s.starts desc)
        from (
          select e.title as label, e.start_date as starts,
                 coalesce(sum(t.quantity_available), 0) as places,
                 (select count(*) from public.club_event_bookings eb
                   where eb.event_id = e.id and eb.status <> 'cancelled') as sold
            from public.club_events e
            left join public.club_event_ticket_types t on t.event_id = e.id
           where e.club_id = p_club and e.status = 'published'
             and e.start_date between p_from and p_to
           group by e.id, e.title, e.start_date
           order by e.start_date desc limit 5
        ) s), '[]'::jsonb)
  ));
end $$;

revoke all on function public.club_analytics_nights(bigint, date, date) from public, anon;
grant execute on function public.club_analytics_nights(bigint, date, date) to authenticated;
