import assert from "node:assert/strict";

import {
  countManageEvents, filterManageEvents, isPast, type ManageEvent,
} from "../event-manage-filter";

const TODAY = "2026-09-12";

const event = (over: Partial<ManageEvent> = {}): ManageEvent => ({
  id: 1, legacyId: "2026-09-26-autumn-open", title: "Autumn Open",
  status: "published", startDate: "2026-09-26", endDate: null,
  venueName: "Didcot Civic Hall", bookings: 0, ticketsAvailable: 40, ...over,
});

// --- past ----------------------------------------------------------------

{
  assert.equal(isPast(event({ startDate: "2026-09-11" }), TODAY), true);
  assert.equal(isPast(event({ startDate: TODAY }), TODAY), false, "today is still on");
  assert.equal(isPast(event({ startDate: "2026-09-26" }), TODAY), false);
  // A two day event that started yesterday and finishes tomorrow is running.
  assert.equal(
    isPast(event({ startDate: "2026-09-11", endDate: "2026-09-13" }), TODAY), false,
    "the end date decides when there is one",
  );
  assert.equal(
    isPast(event({ startDate: null, endDate: null }), TODAY), false,
    "an undated draft has not happened",
  );
}

// --- the tabs ------------------------------------------------------------

const SET: ManageEvent[] = [
  event({ id: 1, title: "Autumn Open", startDate: "2026-09-26", bookings: 8 }),
  event({ id: 2, title: "Spring Open", startDate: "2026-03-01", bookings: 20 }),
  event({ id: 3, title: "Summer Open", startDate: "2026-06-01", bookings: 4 }),
  event({ id: 4, title: "Winter plan", status: "draft", startDate: "2026-12-05" }),
  // A draft dated in the past is still a draft, not a past event.
  event({ id: 5, title: "Old plan", status: "draft", startDate: "2026-01-05" }),
  event({ id: 6, title: "Called off", status: "cancelled", startDate: "2026-10-01" }),
];

{
  const counts = countManageEvents(SET, TODAY);
  assert.deepEqual(counts, { upcoming: 1, past: 2, drafts: 2, cancelled: 1 });

  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(all, SET.length, "every event lands in exactly one tab");
}

{
  const drafts = filterManageEvents(SET, { tab: "drafts", today: TODAY });
  assert.deepEqual(drafts.map((e) => e.id), [5, 4], "drafts read soonest first");

  const past = filterManageEvents(SET, { tab: "past", today: TODAY });
  assert.deepEqual(past.map((e) => e.id), [3, 2], "past reads newest first");

  const cancelled = filterManageEvents(SET, { tab: "cancelled", today: TODAY });
  assert.deepEqual(cancelled.map((e) => e.id), [6],
    "a cancelled event in the future is not upcoming");
}

// --- search --------------------------------------------------------------

{
  const byTitle = filterManageEvents(SET, { tab: "past", query: "spring", today: TODAY });
  assert.deepEqual(byTitle.map((e) => e.id), [2], "title, case-insensitively");

  const byVenue = filterManageEvents(SET, { tab: "upcoming", query: "civic", today: TODAY });
  assert.deepEqual(byVenue.map((e) => e.id), [1], "the hall it runs in");

  const none = filterManageEvents(SET, { tab: "upcoming", query: "zzz", today: TODAY });
  assert.deepEqual(none, []);

  const noVenue = filterManageEvents(
    [event({ id: 9, venueName: null })], { tab: "upcoming", query: "hall", today: TODAY },
  );
  assert.deepEqual(noVenue, [], "a missing venue is not a match and is not a crash");
}

// --- sorting -------------------------------------------------------------

{
  const byTickets = filterManageEvents(SET, { tab: "past", sort: "tickets", today: TODAY });
  assert.deepEqual(byTickets.map((e) => e.id), [2, 3], "busiest first");

  const byTitle = filterManageEvents(SET, { tab: "past", sort: "title", today: TODAY });
  assert.deepEqual(byTitle.map((e) => e.title), ["Spring Open", "Summer Open"]);
}

{
  // An undated draft sorts last rather than to the top as 1970.
  const rows = filterManageEvents(
    [event({ id: 7, status: "draft", startDate: null, title: "Untitled" }),
     event({ id: 8, status: "draft", startDate: "2026-12-01", title: "December" })],
    { tab: "drafts", today: TODAY },
  );
  assert.deepEqual(rows.map((e) => e.id), [8, 7]);
}

console.log("event-manage-filter: all assertions passed");
