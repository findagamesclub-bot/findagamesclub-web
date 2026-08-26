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
  eventType: string | null;
  price: string | null;
  roundCount: number | null;
  ticketsAvailable: number | null;
  venueName: string | null;
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

  upcomingEvents: ClubEventSummary[];
  pastEvents: ClubEventSummary[];

  reviews: ClubReview[];
  reviewSummary: { average: number; count: number } | null;
};
