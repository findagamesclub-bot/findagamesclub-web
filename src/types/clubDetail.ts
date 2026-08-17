import type { ClubSession } from "./club";

export type ClubImage = { src: string; alt: string };
export type ClubLink = { label: string; url: string };
export type PricingModel = { label: string; price: string; notes: string };
export type Announcement = { message: string; createdAt: string };

export type MembershipTier = {
  key: string;
  label: string;
  price: string;
  priceDuration: string;
  description: string | null;
  isBasic: boolean;
  benefits: string[];
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
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type ClubDetail = {
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
