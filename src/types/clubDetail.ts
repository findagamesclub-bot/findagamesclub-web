import type { ClubSession } from "./club";
import type { BillingOption } from "./payment";

export type ClubImage = { src: string; alt: string };
export type ClubLink = { label: string; url: string };
/** `price` is null when the club left it blank or wrote "TBC". */
export type PricingModel = { label: string; price: string | null; notes: string };
export type Announcement = { message: string; createdAt: string };

export type MembershipTier = {
  key: string;
  label: string;
  /** Null when the club left it blank — the card hides the line rather than showing "£". */
  price: string | null;
  priceDuration: string;
  description: string | null;
  isBasic: boolean;
  benefits: string[];
  /**
   * The same perks under Savings / Access / Tools. Computed here for the same
   * reason as the discount: describeTierBenefits turns the object into
   * sentences, and the grouping cannot be recovered from prose.
   */
  benefitGroups: { group: string; label: string; items: string[] }[];
  /**
   * The club's raw benefit switches. Sentences cannot be compared column by
   * column, so the comparison table reads these instead. Public club config,
   * the same values the tier card is built from.
   */
  benefitValues: Record<string, unknown>;
  /** Monthly / yearly / one-off. Empty when the tier is free. */
  billingOptions: BillingOption[];
  /**
   * Taken off event tickets for members on this tier. describeTierBenefits
   * turns the benefits object into sentences, which loses the number, so it is
   * carried separately rather than parsed back out of prose.
   */
  eventDiscountPercent: number;
  /**
   * Discussion categories this tier reserves. Same reasoning as the discount:
   * describeTierBenefits turns the object into sentences and loses the list.
   */
  reservedCategories: string[];
};

export type ClubEventSummary = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  eventType: string | null;
  price: string | null;
  roundCount: number | null;
  ticketsAvailable: number | null;
  venueName: string | null;
  /** Where it actually runs. Often the club's own hall, sometimes not. */
  venue: { name: string | null; address: string | null; postcode: string | null };
  hasEnded: boolean;
};

export type ClubReview = {
  id: number;
  authorId: string | null;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** Set when the club has asked an admin to look at it. Still visible. */
  flaggedAt: string | null;
  flaggedByName: string | null;
};

export type ClubDetail = {
  /** Needed by the membership actions; never shown. */
  id: number;
  ownerId: string | null;
  slug: string;
  name: string;
  city: string;
  neighbourhood: string | null;
  country: string;
  summary: string | null;
  description: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  announcement: string | null;

  venue: {
    name: string | null;
    address: string | null;
    postcode: string | null;
    district: string | null;
    /** Null when the postcode could not be placed. All 11 clubs currently have one. */
    coordinates: { latitude: number; longitude: number } | null;
    /** Opens the venue in the viewer's own maps app. */
    directionsUrl: string | null;
  };
  contact: { email: string | null; website: string | null };

  meetingLabel: string | null;
  schedule: ClubSession[];
  tablesAvailable: number | null;
  memberCount: number | null;
  fromPrice: string | null;
  membershipPrice: string | null;
  ages: string | null;
  accessibility: string[];
  tags: string[];

  formats: string[];
  games: string[];
  facilities: string[];
  paymentMethods: string[];
  discussionCategories: string[];

  images: ClubImage[];
  socialLinks: ClubLink[];
  pricingModels: PricingModel[];
  announcements: Announcement[];
  membershipTiers: MembershipTier[];

  reviews: ClubReview[];
  reviewSummary: { average: number; count: number } | null;
};
