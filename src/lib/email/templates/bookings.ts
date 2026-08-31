import { build, greet, type Email } from "./build";

export function tablePromoted(params: {
  name?: string;
  clubName: string;
  night: string;
  time: string;
  gameTitle: string;
  price?: string | null;
  url: string;
}): Email {
  const greeting = greet(params.name);
  const body = [
    greeting,
    `A table came free at ${params.clubName} and you were next on the list, so it is yours.`,
    // Built from the parts that are actually present: an empty time used to
    // leave a dangling separator reading "Thu 27 Aug, . kill game".
    [
      params.night,
      params.time || null,
      params.gameTitle || null,
      params.price ? `${params.price} a table` : null,
    ].filter(Boolean).join(". ") + ".",
    "You did not have to do anything for this, so if you can no longer make it, please cancel and let the next person have it.",
  ];

  return build(`You have a table at ${params.clubName}`, {
    previewText: `A table came free on ${params.night}.`,
    eyebrow: "Off the waiting list",
    heading: "A table came free",
    body,
    action: { label: "See the booking", url: params.url },
  });
}

export function tableCancelled(params: {
  name?: string;
  clubName: string;
  night: string;
  url: string;
}): Email {
  const greeting = greet(params.name);
  return build(`Your table at ${params.clubName} is cancelled`, {
    previewText: `Your ${params.night} table has been cancelled.`,
    eyebrow: "Booking cancelled",
    heading: "Your table is cancelled",
    body: [
      greeting,
      `The table you were on at ${params.clubName} on ${params.night} has been cancelled.`,
      "If that was not you, the club or the person who booked it cancelled the game.",
    ],
    action: { label: "Book another night", url: params.url },
  });
}

export function ticketsBooked(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  when: string;
  reference: string;
  tickets: string;
  total: string;
  url: string;
}): Email {
  const greeting = greet(params.name);
  return build(`Your place at ${params.eventTitle}`, {
    previewText: `Reference ${params.reference}. ${params.when}.`,
    eyebrow: "Booking confirmed",
    heading: "You are booked in",
    body: [
      greeting,
      `${params.clubName} has your place at ${params.eventTitle}.`,
      [params.when, params.tickets, params.total].filter(Boolean).join(". ") + ".",
      // The reference is the thing they will be asked for on the door, so it is
      // its own line rather than buried in a sentence.
      `Your reference is ${params.reference}.`,
      "The club takes payment either before the event or on the day, depending on their terms. "
      + "Quote the reference when you arrive.",
    ],
    action: { label: "See your ticket", url: params.url },
    footnote: "If you can no longer make it, cancel from your tickets so somebody else can take the place.",
  });
}

export function ticketsCancelled(params: {
  name?: string;
  clubName: string;
  eventTitle: string;
  reference: string;
  url: string;
}): Email {
  const greeting = greet(params.name);
  return build(`Your booking for ${params.eventTitle} is cancelled`, {
    previewText: `Booking ${params.reference} has been cancelled.`,
    eyebrow: "Booking cancelled",
    heading: "Your booking is cancelled",
    body: [
      greeting,
      `Booking ${params.reference} for ${params.eventTitle} at ${params.clubName} has been cancelled, and your place has gone back into the pool.`,
      "If that was not you, contact the club. They can cancel a booking too.",
    ],
    action: { label: "See the event", url: params.url },
  });
}

/**
 * The confirmation for a table the member booked themselves.
 *
 * Legacy sends nothing here at all — it writes an in-app message from a
 * synthetic club account (club_store.py:16468). A table on a Thursday three
 * weeks out is exactly the thing people forget, so it needs to be in an inbox.
 */
export function tableBooked(params: {
  name?: string;
  clubName: string;
  night: string;
  time: string;
  gameTitle: string;
  tableIndex: number;
  price: string;
  /** Only when the member actually spent some. */
  pointsSpent?: number;
  opponentName?: string | null;
  url: string;
}): Email {
  const body = [
    greet(params.name),
    `${params.clubName} has your table.`,
  ];
  if (params.pointsSpent) {
    body.push(
      `You put ${params.pointsSpent} loyalty ${params.pointsSpent === 1 ? "point" : "points"} towards it, and that is already off the price below.`,
    );
  }
  body.push("Nothing has been charged. Clubs take table money at the door.");

  const rows = [
    { label: "When", value: [params.night, params.time].filter(Boolean).join(", ") },
    { label: "Playing", value: params.gameTitle },
    { label: "Table", value: `${params.tableIndex}` },
  ];
  // Only when they named one. "Opponent: none" reads like a failed lookup.
  if (params.opponentName) rows.push({ label: "Opponent", value: params.opponentName });

  return build(`Your table at ${params.clubName} on ${params.night}`, {
    previewText: `${params.night}. Table ${params.tableIndex}. ${params.gameTitle}.`,
    eyebrow: "Table booked",
    heading: "Your table is booked",
    body,
    details: { rows, total: { label: "Price", value: params.price } },
    action: { label: "See the booking", url: params.url },
    footnote: "If you can no longer make it, cancel from the club's booking page so somebody else can have the table.",
  });
}
