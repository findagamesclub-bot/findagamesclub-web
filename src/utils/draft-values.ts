/**
 * A stored payload, back in the shape the five step components render.
 *
 * The inverse of `listing-payload`: that turns a form into database shape, this
 * turns database shape back into fields. The console's builder gets the same
 * thing from the club's own tables, so the two builders hand their steps
 * identical props and neither component knows which it is in.
 *
 * Everything defaults, because a draft is by definition half written. A missing
 * section is an empty one, never a crash on step four because nobody has
 * reached step three yet.
 */

type Row = Record<string, unknown>;

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]).filter((r) => r && typeof r === "object") : [];

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const numberText = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "" : String(value);

export function draftValues(payload: Record<string, unknown>) {
  const club = (payload.club ?? {}) as Row;

  return {
    profile: {
      name: text(club.name),
      city: text(club.city),
      neighbourhood: text(club.neighbourhood),
      summary: text(club.summary),
      description: text(club.description),
      formats: strings(payload.formats),
      venueName: text(club.venue_name),
      venueAddress: text(club.venue_address),
      postcode: text(club.venue_postcode),
      website: text(club.website_url),
      contactEmail: text(club.contact_email),
      // A string here, because `ProfileStep` wants tokens and the page splits
      // it with the same `parseTokens` the console uses.
      ages: text(club.ages),
      memberCount: numberText(club.member_count),
      tablesAvailable: numberText(club.tables_available),
    },

    content: {
      games: strings(payload.games),
      facilities: strings(payload.facilities),
      paymentMethods: strings(payload.payment_methods),
      socialLinks: rows(payload.social_links).map((r) => ({
        label: text(r.label), url: text(r.url),
      })),
      categories: rows(payload.categories).map((r) => ({
        id: text(r.id), label: text(r.label),
      })),
      // Always empty: photos wait until the club exists, because a listing
      // being written has no folder in Storage to put them in.
      photos: [] as never[],
    },

    pricing: {
      models: rows(payload.pricing_models).map((r) => ({
        label: text(r.label), price: text(r.price), notes: text(r.notes),
      })),
      tiers: rows(payload.tiers).map((r) => ({
        key: text(r.tier_key),
        label: text(r.label),
        price: text(r.price),
        duration: text(r.price_duration),
        description: text(r.description),
        isBasic: r.is_basic === true,
        // Nobody holds a tier on a club that does not exist, so no tier here
        // can be undeletable. On a live club this is a real count.
        held: 0,
        benefits: JSON.stringify(r.benefits ?? {}),
        billing: JSON.stringify(r.billing_options ?? []),
      })),
      loyaltyEnabled: ((payload.loyalty ?? {}) as Row).enabled === true,
    },

    schedule: {
      nights: rows(payload.sessions).map((r) => ({
        id: text(r.id),
        day: text(r.day),
        time: text(r.time),
        label: text(r.label),
        // Same reasoning as `held`: there are no bookings on a club nobody can
        // find yet, so no night here is pinned.
        booked: 0,
      })),
      notices: rows(payload.announcements).map((r) => text(r.message)).filter(Boolean),
    },
  };
}
