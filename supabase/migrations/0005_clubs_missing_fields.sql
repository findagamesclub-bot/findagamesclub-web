-- 0005 · Fields found by auditing the source data
--
-- accessibility was typed as text in 0002 but is a list in every source record.
-- spotlight, announcement and the postcode district/area were missed entirely.

alter table public.clubs drop column if exists accessibility;

alter table public.clubs
  add column accessibility           text[] not null default '{}',
  add column spotlight               boolean not null default false,
  add column announcement            text,
  add column venue_postcode_district text,
  add column venue_postcode_area     text,
  add column coordinates_label       text;

comment on column public.clubs.spotlight is 'Featured on the directory. Admin-set, never owner-set.';
comment on column public.clubs.venue_postcode_district is 'e.g. OX11 — shown on the listing location line.';

create index clubs_spotlight_idx on public.clubs (spotlight) where spotlight;

grant update (accessibility, announcement) on public.clubs to authenticated;
-- spotlight is deliberately NOT granted: a club that can feature itself makes
-- the featured flag meaningless.
