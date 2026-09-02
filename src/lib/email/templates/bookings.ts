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

/**
 * To the club, not the buyer.
 *
 * A club has always found out about ticket sales by opening the door list and
 * counting. Merchandise orders, coaching places and table bookings all reach
 * the owner's inbox; the one thing that takes real money at the door did not.
 */
export function ticketsForOwner(params: {
  clubName: string;
  eventTitle: string;
  when: string;
  buyerName: string;
  tickets: string;
  total: string;
  reference: string;
  url: string;
}): Email {
  return build(`${params.buyerName} booked ${params.eventTitle}`, {
    previewText: `${params.tickets}. ${params.when}.`,
    eyebrow: "Tickets booked",
    heading: `${params.buyerName} is coming`,
    body: [
      `${params.buyerName} has booked into ${params.eventTitle} at ${params.clubName}.`,
      "Nothing has been charged. You settle up with them before the event or on the day, whichever your club does.",
    ],
    details: {
      rows: [
        { label: "Event", value: params.eventTitle },
        { label: "When", value: params.when },
        { label: "Tickets", value: params.tickets },
        { label: "Reference", value: params.reference },
      ],
      total: { label: "Due", value: params.total },
    },
    action: { label: "Open the door list", url: params.url },
  });
}

/** To the club, when somebody gives a place back. */
export function ticketsCancelledForOwner(params: {
  clubName: string;
  eventTitle: string;
  buyerName: string;
  tickets: string;
  url: string;
}): Email {
  return build(`${params.buyerName} cancelled for ${params.eventTitle}`, {
    previewText: `A place has gone back into the pool at ${params.clubName}.`,
    eyebrow: "Booking cancelled",
    heading: `${params.buyerName} has cancelled`,
    body: [
      `${params.buyerName} has given back ${params.tickets} for ${params.eventTitle}.`,
      "Those places are back in the pool and can be sold again.",
    ],
    action: { label: "Open the door list", url: params.url },
  });
}

/**
 * Somebody took up an advert, so the poster now has a table.
 *
 * The same reasoning as tablePromoted: they are committed to a night, at a
 * price, against a named opponent, and they were not looking at the site when
 * it happened. A bell they might not check is not enough on its own.
 */
export function gameFound(params: {
  name?: string;
  clubName: string;
  opponentName: string;
  gameTitle: string;
  night: string;
  time: string;
  price?: string | null;
  url: string;
}): Email {
  return build(`${params.opponentName} took up your game at ${params.clubName}`, {
    previewText: `${params.gameTitle} on ${params.night}. The table is booked.`,
    eyebrow: "You have a game",
    heading: `${params.opponentName} is up for it`,
    body: [
      greet(params.name),
      `${params.opponentName} has taken up your ${params.gameTitle} advert at ${params.clubName}, and a table is booked in your name.`,
      "You did not have to do anything for this, so if you can no longer make it, please cancel and let somebody else have the table.",
    ],
    details: {
      rows: [
        { label: "When", value: [params.night, params.time].filter(Boolean).join(", ") },
        { label: "Playing", value: params.gameTitle },
        { label: "Opponent", value: params.opponentName },
      ],
      ...(params.price ? { total: { label: "Price", value: params.price } } : {}),
    },
    action: { label: "See the booking", url: params.url },
  });
}

/**
 * To the club, when a member puts an advert up.
 *
 * An advert that never finds an opponent is the one the club most needs to see,
 * and by the time it converts into a booking nobody needed telling. The notes
 * are carried because that is where the useful part usually is: the terrain
 * they need, the fact it is their first game.
 */
export function lookingForGameForOwner(params: {
  clubName: string;
  memberName: string;
  gameTitle: string;
  night: string;
  time: string;
  notes?: string | null;
  url: string;
}): Email {
  const body = [
    `${params.memberName} is looking for an opponent at ${params.clubName}.`,
  ];
  if (params.notes?.trim()) body.push(`They said: ${params.notes.trim()}`);
  body.push("Nothing is needed from you. It is here in case you can put somebody in touch.");

  return build(`${params.memberName} wants a game of ${params.gameTitle}`, {
    previewText: `${params.gameTitle} on ${params.night}.`,
    eyebrow: "Looking for a game",
    heading: `${params.memberName} needs an opponent`,
    body,
    details: {
      rows: [
        { label: "Playing", value: params.gameTitle },
        { label: "When", value: [params.night, params.time].filter(Boolean).join(", ") },
      ],
    },
    action: { label: "See the club's nights", url: params.url },
  });
}
