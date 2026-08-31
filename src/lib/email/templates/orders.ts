import { build, greet, type Email } from "./build";

/**
 * Merchandise and coaching confirmations.
 *
 * Both say the same careful thing about money: nothing has been taken. The club
 * settles up at the desk or sends its own invoice, and a confirmation that read
 * like a paid receipt would have people turning up expecting to owe nothing.
 */

export function merchandiseOrdered(params: {
  name?: string;
  clubName: string;
  reference: string;
  /** One per line of the order, already worded, e.g. "2 × Club shirt". */
  lines: { label: string; value: string }[];
  total: string;
  /** Only when the member actually spent some. */
  pointsSpent?: number;
  url: string;
}): Email {
  const body = [
    greet(params.name),
    `${params.clubName} has your order. Nothing has been charged.`,
  ];
  if (params.pointsSpent) {
    body.push(
      `You put ${params.pointsSpent} loyalty ${params.pointsSpent === 1 ? "point" : "points"} towards it, and that is already off the total below.`,
    );
  }
  body.push("The club will be in touch about payment, or you can settle up at the desk.");

  return build(`Your order from ${params.clubName}`, {
    previewText: `Order ${params.reference}. ${params.total}.`,
    eyebrow: "Order received",
    heading: "Your order is with the club",
    body,
    details: { rows: params.lines, total: { label: "Total", value: params.total } },
    action: { label: "See your order", url: params.url },
    footnote: `Quote ${params.reference} if you get in touch about this order.`,
  });
}

export function coachingBooked(params: {
  name?: string;
  clubName: string;
  title: string;
  when: string;
  coachingType: string;
  price: string;
  url: string;
}): Email {
  return build(`Your coaching place at ${params.clubName}`, {
    previewText: `${params.title}. ${params.when}.`,
    eyebrow: "Coaching booked",
    heading: "You have a place",
    body: [
      greet(params.name),
      `${params.clubName} has your place on ${params.title}.`,
      "Nothing has been charged. The club takes payment on the day unless they tell you otherwise.",
    ],
    details: {
      rows: [
        { label: "Session", value: params.title },
        { label: "When", value: params.when },
        { label: "Type", value: params.coachingType },
      ],
      total: { label: "Price", value: params.price },
    },
    action: { label: "See the session", url: params.url },
    footnote: "If you can no longer make it, cancel from the coaching page so somebody else can take the place.",
  });
}
