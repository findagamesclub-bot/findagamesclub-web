import "server-only";

import { unstable_cache } from "next/cache";

import * as repo from "@/repositories/featured.repository";
import * as notify from "./featured-notify.service";
import { billingRefusal } from "@/utils/billing-refusals";
import {
  NO_FEATURED_FACETS, featuredClubId, featuredSort, featuredState, featuredWhen,
  type FeaturedFacets, type FeaturedFilters,
} from "@/utils/featured-filters";
import { londonNow } from "@/utils/dates";

export type FeaturedResult = { ok: true } | { ok: false; error: string };

export const FEATURED_TAG = "featured-clubs";

/**
 * Who leads the homepage.
 *
 * The same answer for every visitor and read on the busiest page in the app, so
 * it is cached for a minute and tagged. Sessionless underneath, because
 * `unstable_cache` cannot contain `cookies()` and the Supabase server client
 * reads them.
 */
const readFeatured = unstable_cache(
  async (limit: number) => repo.findFeaturedClubs(limit).catch(() => []),
  ["featured-clubs"],
  { revalidate: 60, tags: [FEATURED_TAG] },
);

export async function getFeaturedClubs(limit = 6) {
  return readFeatured(limit);
}

// Twenty-four, not the twenty-five the other admin lists use: this one draws
// three across, and twenty-five leaves a last row holding one card.
const PER_PAGE = 24;

/**
 * One slot as the admin board draws it.
 *
 * The payment is on the row rather than in a map beside it, because 0226
 * hands both back together. Before this the page read every slot the site had
 * ever sold and then passed every one of their ids into a second function, so
 * the cost of opening it grew with the whole history of the product.
 */
export type FeaturedSlot = {
  id: number;
  clubId: number;
  clubSlug: string;
  clubName: string;
  clubCity: string;
  startsOn: string;
  endsOn: string;
  pricePence: number;
  currency: string;
  note: string;
  paidAt: string | null;
  paymentMethod: string;
  paymentNote: string;
};

/**
 * A page of slots, the counts beside the tabs, and what the pickers may offer.
 *
 * One wave of three. None of them needs another's answer, so waiting would
 * cost 300ms for nothing, and each is caught on its own: a board whose month
 * picker would not load is still a board.
 *
 * The client, item 16c: *"on the featured section in admin, we need to add
 * some filters for paid/unpaid, date and club. Without these when lots of
 * featured bookings are added, it will be hard to navigate."*
 */
export type FeaturedList = {
  rows: FeaturedSlot[];
  total: number; page: number; perPage: number; failed: boolean;
  counts: Record<string, number>;
  facets: FeaturedFacets;
  live: number;
  state: string; when: string; sort: string;
};

const EMPTY_LIST: Omit<FeaturedList, "live"> = {
  rows: [], total: 0, page: 1, perPage: PER_PAGE, failed: false,
  counts: { all: 0, topay: 0, paid: 0 }, facets: NO_FEATURED_FACETS,
  state: "", when: "", sort: "newest",
};

/**
 * Just the figure the Slots tab wears, for the two tabs that draw no list.
 *
 * The tab row is on every tab, so the live count has to be read on every tab;
 * the page of slots and the counts beside its own tabs do not. Asking for all
 * three from the Asked-for tab is two round trips spent on a list nobody is
 * looking at.
 */
export async function getFeaturedHeadline(): Promise<FeaturedList> {
  const facets = await repo
    .findFeaturedFacets({ when: "", query: "", month: "", club: null })
    .catch(() => null);
  return { ...EMPTY_LIST, live: facets?.live ?? 0 };
}

export async function getFeaturedSlots(filters: FeaturedFilters): Promise<FeaturedList> {
  const state = featuredState(filters.state);
  const when = featuredWhen(filters.when);
  const sort = featuredSort(filters.sort);
  const club = featuredClubId(filters.club);

  const [rows, counts, facets] = await Promise.all([
    repo.findFeaturedSlotsPage({
      state, when, sort, club,
      query: filters.query, month: filters.month,
      page: filters.page, per: PER_PAGE,
    }).catch((error) => {
      console.error("[featured] the slots did not load", error);
      return null;
    }),
    repo.findFeaturedSlotCounts({
      when, club, query: filters.query, month: filters.month,
    }).catch(() => null),
    // Each picker is narrowed by the others, so the months it offers and the
    // clubs it offers both answer the screen in front of the reader rather
    // than the whole site.
    repo.findFeaturedFacets({
      when, club, query: filters.query, month: filters.month,
    }).catch(() => null),
  ]);

  return {
    rows: (rows ?? []).map((row): FeaturedSlot => ({
      id: row.id,
      clubId: row.club_id,
      clubSlug: row.club_slug ?? "",
      // A slot outlives the club it was sold to, because the row is kept for
      // the accounts. Saying so beats drawing a card with no name on it.
      clubName: row.club_name ?? "A club that has gone",
      clubCity: row.club_city ?? "",
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      pricePence: row.price_pence,
      currency: row.currency ?? "GBP",
      note: row.note ?? "",
      paidAt: row.paid_at,
      paymentMethod: row.payment_method ?? "",
      paymentNote: row.payment_note ?? "",
    })),
    // The total rides on every row, so an empty page answers zero rather than
    // reading it off a row that is not there. Getting that wrong shows "no
    // slots" beside a pager offering page four.
    total: rows?.[0]?.total_rows ?? 0,
    page: filters.page,
    perPage: PER_PAGE,
    // A read that failed is not a filter that matched nothing. Without this
    // the page says "No slot matches that" to somebody whose database has not
    // had 0226 run against it, which sends them looking for a slot that is
    // sitting right there.
    failed: rows === null,
    // Zeros rather than nothing when the counts fail: the bar prints what it
    // is given and `undefined` draws a blank where a number should be.
    counts: counts ?? { all: 0, topay: 0, paid: 0 },
    facets: facets
      ? { months: facets.months ?? [], clubs: facets.clubs ?? [] }
      : NO_FEATURED_FACETS,
    live: facets?.live ?? 0,
    state, when, sort,
  };
}

/**
 * One club's own slots, for its billing page.
 *
 * Shaped here rather than handed over as rows, because the page splits them
 * with `splitSlots` and a pure util should not be reading `starts_on`.
 */
export type ClubFeaturedSlot = {
  id: number;
  startsOn: string;
  endsOn: string;
  pricePence: number;
  currency: string;
  note: string;
  /**
   * When we recorded the money for it, or null because nobody has said. The
   * client's words: *"it is not clear what is paid and what is not"*, over
   * three slots at £20 apiece.
   */
  paidAt: string | null;
  paymentMethod: string;
  /**
   * What we wrote down when we recorded the money. The admin's own dialog
   * says "The club sees this" about it, and until 15c nothing on the club's
   * side drew it: a promise the screen did not keep.
   */
  paymentNote: string;
  /**
   * False when the read failed, so the panel says nothing rather than
   * "not paid yet" about a slot nobody asked about. An unreadable table that
   * degrades into a plausible sentence is the trap 0116 paid for.
   */
  paymentKnown: boolean;
};

export async function getClubSlots(clubId: number): Promise<ClubFeaturedSlot[]> {
  const rows = await repo.findSlotsForClub(clubId).catch((error) => {
    // Logged rather than swallowed. An empty list here reads as "this club has
    // never been featured", which is a believable sentence about a club that
    // is on the homepage as we speak.
    console.error("[featured] a club's own slots did not load", error);
    return [];
  });

  // Its own read, for the reason the repository gives. Caught rather than
  // thrown: a club that cannot see which slots it has settled still has a
  // useful list of them, and a billing page that will not load does not.
  let known = true;
  const paid = await repo.findFeaturedPayments(rows.map((row) => row.id))
    .catch((error) => {
      console.error("[featured] the payment standing did not load", error);
      known = false;
      return new Map<number, repo.FeaturedPayment>();
    });

  return rows.map((row) => ({
    id: row.id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    pricePence: row.price_pence,
    currency: row.currency ?? "GBP",
    note: row.note ?? "",
    paidAt: paid.get(row.id)?.paid_at ?? null,
    paymentMethod: paid.get(row.id)?.payment_method ?? "",
    paymentNote: paid.get(row.id)?.payment_note ?? "",
    paymentKnown: known,
  }));
}

/**
 * Recording what arrived for a slot, which only an admin may do.
 *
 * 0161 settled that featuring is a placement we sell and settle offline, so
 * whether the money came in is our word. The club reads the answer on its own
 * billing page and cannot write it.
 */
export async function recordFeaturedPayment(params: {
  slot: number; paid: boolean; method: string; note: string;
}): Promise<FeaturedResult> {
  try {
    await repo.recordFeaturedPayment(params);
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }
  return { ok: true };
}

export async function getClubsForPicker() {
  return repo.findClubsForPicker().catch(() => []);
}

/**
 * Book a slot, and tell the club it is on one.
 *
 * The bell is 0155's trigger, so it fires whatever writes the row. The email is
 * here, because nothing in SQL sends one. It is deliberately after the write
 * and deliberately not awaited for a result: a bounced message must never turn
 * a booked slot into "could not book that".
 */
export async function featureClub(params: {
  club: number; from: string; to: string | null;
  pricePence: number | null; note: string;
}): Promise<FeaturedResult & { slotId?: number }> {
  let slotId: number;
  try {
    slotId = await repo.featureClub(params);
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }

  try {
    // The row rather than the form: `feature_club` fills in the end date from
    // the configured duration and the price from the settings when neither was
    // typed, so the email would otherwise quote figures nobody agreed to.
    const held = await repo.findSlot(slotId);
    if (held?.club) {
      await notify.featuredBooked(
        { slug: held.club.slug, name: held.club.name, ownerId: held.club.owner_id },
        held.starts_on, held.ends_on, held.price_pence,
        held.starts_on <= todayIso());
    }
  } catch (error) {
    console.error("[featured] could not write to the club about a new slot", error);
  }
  // Handed back so a booking made in answer to a club's request can be tied to
  // it. The slot is the answer, so the request is marked against this id rather
  // than the admin pressing a second button to say what they just did.
  return { ok: true, slotId };
}

/**
 * Take a slot down, and say so when it had not finished.
 *
 * Read before the delete, because the row is gone afterwards and the owner's
 * address hangs off the club. A slot that already ended says nothing: the owner
 * was told when it ended and telling them again because somebody tidied the
 * list is the site inventing news. 0155's trigger draws the same line.
 */
export async function unfeatureClub(slot: number): Promise<FeaturedResult> {
  let held: Awaited<ReturnType<typeof repo.findSlot>> = null;
  try {
    held = await repo.findSlot(slot);
  } catch (error) {
    console.error("[featured] could not read a slot before removing it", error);
  }

  try {
    await repo.unfeatureClub(slot);
  } catch (error) {
    return { ok: false, error: billingRefusal(error) };
  }

  try {
    if (held?.club && held.ends_on >= todayIso()) {
      await notify.featuredRemoved(
        { slug: held.club.slug, name: held.club.name, ownerId: held.club.owner_id },
        held.ends_on);
    }
  } catch (error) {
    console.error("[featured] could not write to the club about a removed slot", error);
  }
  return { ok: true };
}

/** A London day, like every other date in this app. */
const todayIso = () => londonNow().date;

/**
 * The clubs wearing the badge today, which is not the same list as the
 * homepage's.
 *
 * "Featured" on a card is a claim that somebody paid for a placement. The
 * directory and the club page were both reading `clubs.spotlight` for it,
 * which is an editorial pick an admin can set on any club, so a club with no
 * booking at all read as featured. The client found that in the directory.
 *
 * `spotlight` keeps the job 0113 gave it: filling the homepage row before
 * anything has been sold, so the front page is not empty on day one. It just
 * does not get to say somebody paid.
 *
 * Cached and tagged with the slots themselves, so booking or removing one
 * clears this in the same breath rather than leaving a badge up for a minute
 * after the slot went.
 */
const readLiveFeatured = unstable_cache(
  async (today: string) => repo.findLiveFeaturedClubIds(today).catch((error): number[] => {
    // Logged rather than swallowed. An empty list here takes the badge off
    // every club, which looks exactly like "nobody is featured today" and is
    // the quietest possible way for this to break.
    console.error("[featured] the live slots did not load", error);
    return [];
  }),
  ["live-featured-clubs"],
  { revalidate: 60, tags: [FEATURED_TAG] },
);

export async function getLiveFeaturedClubIds(): Promise<number[]> {
  // The London day, because a slot runs on London days and a boundary read in
  // the server's timezone puts a slot's last evening in the wrong day. The
  // same helper every other date on this page already goes through.
  return readLiveFeatured(todayIso());
}
