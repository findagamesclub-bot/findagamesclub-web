-- Demo data: pairings and a roster, so the event sections have something in them
--
-- The client could not see round pairings, the roster or placings on the event
-- they opened, and asked for them "so I can see the design and layout". They
-- were not broken. Didcot's three events happen to hold one piece each: the
-- Autumn Open has ticket holders and nothing else, the Fun Tournament has a
-- draw and no attendees, the RTT has final standings and neither.
--
-- This fills the gaps so two pages show the whole design, each in the state
-- that makes sense for its date:
--
--   Autumn Open (26 Sep, upcoming) — noticeboard, a drawn round one with
--   scores in, an undrawn round two, and a roster.
--   Warhammer 40k RTT (4 Apr, finished) — the standings it already has, plus
--   the draw and the roster that produced them.
--
-- Deliberately NOT putting standings on the Autumn Open. "Final standings" on
-- a tournament nobody has turned up to yet is the page telling a lie to make a
-- screenshot look full.
--
-- THIS IS TEST DATA. The revert is at the bottom of this file.

begin;

-- The club is told when somebody books a ticket. Nobody booked these, and the
-- RTT finished in April, so ten "someone booked tickets" notices at the owner
-- would be the seed lying to them. Off for the duration, and inside the
-- transaction so a failure anywhere below cannot leave it off.
alter table public.club_event_bookings disable trigger club_event_bookings_notify_club;

-- Six more people at the Autumn Open, so a draw has somebody to draw. Gulnabi
-- and Joe already hold real tickets bought through the app.
insert into public.club_event_bookings
  (club_id, event_id, profile_id, full_name, email, reference, status, subtotal, total, notes)
select 9, 115, null, v.name, v.email, v.ref, 'reserved', 0, 0, 'demo'
  from (values
    ('Tom Allen',  'tom.allen@example.test',  'DEMO-AO-01'),
    ('Peter Hill', 'peter.hill@example.test', 'DEMO-AO-02'),
    ('Joe Gary',   'joe.gary@example.test',   'DEMO-AO-03'),
    ('Hugo S',     'hugo.s@example.test',     'DEMO-AO-04'),
    ('David M',    'david.m@example.test',    'DEMO-AO-05'),
    ('Pete H',     'pete.h@example.test',     'DEMO-AO-06')
  ) as v(name, email, ref)
 where not exists (select 1 from public.club_event_bookings b where b.reference = v.ref);

-- A ticket line per demo booking. The roster counts seats from the items, not
-- from the booking, so a booking with no line against it shows the person on
-- the list holding nothing.
insert into public.club_event_booking_items
  (booking_id, ticket_type_id, label, price, unit_amount, quantity)
select b.id, 25, 'Standard entry', '£30', 30.00, 1
  from public.club_event_bookings b
 where b.reference like 'DEMO-AO-%'
   and not exists (select 1 from public.club_event_booking_items i where i.booking_id = b.id);

-- Round one played, round two drawn but not yet played. Both states on one
-- page, which is what a tournament actually looks like mid-morning.
--
-- The key names match what the importer wrote (playerOneName, not playerOne)
-- and what the reader expects to see.
insert into public.club_event_pairings (event_id, round, label, matches)
select 115, 1, 'Round 1', '[
  {"table":"1","playerOneName":"Gulnabi Afridi","playerTwoName":"Tom Allen",
   "playerOneScore":"78","playerTwoScore":"15"},
  {"table":"2","playerOneName":"Joe Matthews","playerTwoName":"Joe Gary",
   "playerOneScore":"55","playerTwoScore":"60"},
  {"table":"3","playerOneName":"Peter Hill","playerTwoName":"Hugo S",
   "playerOneScore":"41","playerTwoScore":"41"},
  {"table":"4","playerOneName":"David M","playerTwoName":"Pete H",
   "playerOneScore":"32","playerTwoScore":"70"}
]'::jsonb
 where not exists (select 1 from public.club_event_pairings p
                    where p.event_id = 115 and p.round = 1);

insert into public.club_event_pairings (event_id, round, label, matches)
select 115, 2, 'Round 2', '[
  {"table":"1","playerOneName":"Gulnabi Afridi","playerTwoName":"Joe Gary",
   "playerOneScore":null,"playerTwoScore":null},
  {"table":"2","playerOneName":"Pete H","playerTwoName":"Peter Hill",
   "playerOneScore":null,"playerTwoScore":null},
  {"table":"3","playerOneName":"Joe Matthews","playerTwoName":"David M",
   "playerOneScore":null,"playerTwoScore":null},
  {"table":"4","playerOneName":"Tom Allen","playerTwoName":"Hugo S",
   "playerOneScore":null,"playerTwoScore":null}
]'::jsonb
 where not exists (select 1 from public.club_event_pairings p
                    where p.event_id = 115 and p.round = 2);

-- The RTT already carries the three final standings the client screenshotted.
-- What it has never had is the attendees and the draw behind them, so the page
-- reads as a tournament that happened rather than a results table on its own.
insert into public.club_event_bookings
  (club_id, event_id, profile_id, full_name, email, reference, status, subtotal, total, notes)
select 9, 113, null, v.name, v.email, v.ref, 'reserved', 0, 0, 'demo'
  from (values
    ('Joe Gary',  'joe.gary@example.test',  'DEMO-RTT-01'),
    ('Tom Allen', 'tom.allen@example.test', 'DEMO-RTT-02'),
    ('Pete H',    'pete.h@example.test',    'DEMO-RTT-03'),
    ('Peter K',   'peter.k@example.test',   'DEMO-RTT-04')
  ) as v(name, email, ref)
 where not exists (select 1 from public.club_event_bookings b where b.reference = v.ref);

insert into public.club_event_booking_items
  (booking_id, ticket_type_id, label, price, unit_amount, quantity)
select b.id, 22, 'Standard', '£30', 30.00, 1
  from public.club_event_bookings b
 where b.reference like 'DEMO-RTT-%'
   and not exists (select 1 from public.club_event_booking_items i where i.booking_id = b.id);

insert into public.club_event_pairings (event_id, round, label, matches)
select 113, 1, 'Round 1', '[
  {"table":"1","playerOneName":"Joe Gary","playerTwoName":"Peter K",
   "playerOneScore":"85","playerTwoScore":"40"},
  {"table":"2","playerOneName":"Tom Allen","playerTwoName":"Pete H",
   "playerOneScore":"62","playerTwoScore":"58"}
]'::jsonb
 where not exists (select 1 from public.club_event_pairings p
                    where p.event_id = 113 and p.round = 1);

insert into public.club_event_pairings (event_id, round, label, matches)
select 113, 2, 'Round 2 (final)', '[
  {"table":"1","playerOneName":"Joe Gary","playerTwoName":"Tom Allen",
   "playerOneScore":"71","playerTwoScore":"64"},
  {"table":"2","playerOneName":"Pete H","playerTwoName":"Peter K",
   "playerOneScore":"90","playerTwoScore":"22"}
]'::jsonb
 where not exists (select 1 from public.club_event_pairings p
                    where p.event_id = 113 and p.round = 2);

alter table public.club_event_bookings enable trigger club_event_bookings_notify_club;

commit;

-- ---------------------------------------------------------------------------
-- REVERT, before a real demo or before launch
-- ---------------------------------------------------------------------------
-- delete from public.club_event_booking_items where booking_id in (
--   select id from public.club_event_bookings
--    where reference like 'DEMO-AO-%' or reference like 'DEMO-RTT-%');
-- delete from public.club_event_bookings where reference like 'DEMO-AO-%' or reference like 'DEMO-RTT-%';
-- delete from public.club_event_pairings where event_id = 115;
-- delete from public.club_event_pairings where event_id = 113;
