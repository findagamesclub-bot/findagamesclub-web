/**
 * A disposition is one row, not one per army that took it.
 *
 * 0209 gave every group a parent, which is right for a detachment and wrong
 * for a disposition: Shield Host belongs to Adeptus Custodes and nothing else,
 * but Purge the Foe is taken by everybody. Splitting it by faction put the
 * same disposition on the screen once per army, which is the shape that made
 * `meta_event` unreadable in the first place.
 *
 * Found by looking at the rendered panel, not at the function: with two armies
 * it is two rows of "Purge the Foe" and at a thirty-player event it would be a
 * list nobody could read. The client's own example is the test: *"Disruption
 * disposition was taken by 20 players, and had a 50% win rate"* is one row.
 *
 * 0209's own text with that one branch changed.
 */
create or replace function public.meta_event_breakdown(p_event bigint)
returns table (
  kind        text,
  label       text,
  -- The faction a detachment belongs to, so "Hallowed Martyrs" is not a row
  -- floating free of the army that fields it. Empty for a faction row.
  parent      text,
  players     bigint,
  appearances bigint,
  games       bigint,
  wins        bigint,
  win_rate    numeric,
  early_signal boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with rows_in as (
    -- 0142's own union, unchanged: a podium army and a table of the draw are
    -- both armies taken to this event.
    select a.* from public.game_result_armies a
     join public.club_event_results r on r.id = a.source_id
    where a.source_type = 'event_podium' and r.event_id = p_event
    union all
    select a.* from public.game_result_armies a
     join public.club_event_pairing_matches m on m.id = a.source_id
    where a.source_type = 'event_pairing' and m.event_id = p_event
  ),
  -- Who each row belongs to. An account where there is one, the typed name
  -- where there is not, and the row itself when it carries neither, so a
  -- nameless army counts once rather than folding into every other.
  tagged as (
    select r.*,
           coalesce(nullif(r.profile_id::text, ''),
                    nullif(lower(btrim(r.player_name)), ''),
                    'row:' || r.id::text) as who
      from rows_in r
     where r.faction_id <> ''
  ),
  parts as (
    select 'faction'::text as kind, t.faction_label as label, ''::text as parent, t.*
      from tagged t
    union all
    select 'detachment', t.detachment, t.faction_label, t.*
      from tagged t where nullif(btrim(t.detachment), '') is not null
    union all
    -- No parent on a disposition, which is where this differed from the
    -- client's own example on the first pass. A detachment belongs to one
    -- faction (Shield Host is Custodes and nothing else), so splitting those
    -- by faction adds information. A disposition is shared: splitting it put
    -- "Purge the Foe" on the screen twice, once per army that took it, which
    -- is the same unreadable shape `meta_event`'s triple produced. Their
    -- example is one row: "Disruption disposition was taken by 20 players,
    -- and had a 50% win rate".
    select 'disposition', t.disposition, ''::text, t.*
      from tagged t where nullif(btrim(t.disposition), '') is not null
  )
  select p.kind, p.label, p.parent,
         count(distinct p.who),
         count(*),
         count(*) filter (where p.outcome <> ''),
         count(*) filter (where p.outcome = 'won'),
         case when count(*) filter (where p.outcome <> '') = 0 then null
              else round(100.0 * count(*) filter (where p.outcome = 'won')
                         / count(*) filter (where p.outcome <> ''), 1) end,
         -- One scored game is not a rate. 0142's own threshold, said here so
         -- the event panel and the tracker agree about what is too early.
         count(*) filter (where p.outcome <> '') < 2
    from parts p
   where nullif(btrim(p.label), '') is not null
   group by p.kind, p.label, p.parent
   -- Best to worst, which is what was asked for, with the ones that have no
   -- rate yet after the ones that have. Then by how many took it, so a tie on
   -- rate leads with the popular one.
   order by p.kind,
            (case when count(*) filter (where p.outcome <> '') = 0 then 1 else 0 end),
            8 desc nulls last, 4 desc, 2;
end;
$$;

revoke all on function public.meta_event_breakdown(bigint) from public, anon;
grant execute on function public.meta_event_breakdown(bigint) to authenticated;
