/** Per-club membership settings. One row per club, from `club_membership_settings`. */
export type MembershipSettings = {
  basicLabel: string;
  /** How many distinct future club nights a member may book across. */
  advanceBookingDates: number;
  /** Bookings a member may hold at once. **0 means unlimited.** */
  upcomingBookingLimit: number;
  eventAdvanceDays: number;
  lookingForGameFutureDates: number;
  lookingForGamePostLimit: number;
  /** 0–100. */
  loyaltyRedemptionCapPercent: number;
};

/** What a specific member may do, after their tier is folded into the club's settings. */
export type MembershipBenefits = {
  advanceBookingDates: number;
  /** 0 means unlimited. */
  maxUpcomingBookings: number;
  eventAdvanceDays: number;
  lookingForGameFutureDates: number;
  lookingForGamePostLimit: number;
  loyaltyRedemptionCapPercent: number;
  bookingDiscountPercent: number;
  waiveGameBookingFee: boolean;
};

/** One row of a club's weekly schedule, from `club_sessions`. */
export type ClubScheduleSlot = {
  id: number;
  /** "Tuesday". Matched against the weekday name. */
  day: string;
  time: string;
  label: string | null;
  /** Position within the club's schedule. Only used to rebuild legacy keys. */
  position: number;
};

/** A bookable night: one schedule slot landed on one real date. */
export type BookableSession = {
  /** Stable across schedule edits, unlike the legacy positional key. */
  clubSessionId: number;
  /** "2026-08-27" */
  date: string;
  day: string;
  time: string;
  label: string | null;
  /** `${date}__${position}` — only for matching imported legacy bookings. */
  legacyKey: string;
};

/** Someone on a booking, in whichever seat. */
export type BookingPerson = {
  profileId: string | null;
  name: string;
  /** True when this seat is the person looking at the page. */
  isViewer: boolean;
};

export type Booking = {
  id: number;
  clubSessionId: number;
  date: string;
  tableIndex: number;
  gameTitle: string;
  notes: string;
  booker: BookingPerson;
  opponent: BookingPerson | null;
  acceptor: BookingPerson | null;
  source: string;
  price: string;
  /** True when the viewer is on this booking in any seat. */
  isMine: boolean;
  canCancel: boolean;
  /**
   * The opponent is a registered member, so their name comes from their
   * profile and typing over it here would change nothing.
   */
  opponentLinked: boolean;
  /** The club may correct any booking; the member only their own, and only
   *  while the night is still ahead. */
  canEdit: boolean;
};

/** A night, with everything the calendar needs to draw it. */
export type CalendarSession = BookableSession & {
  capacity: number;
  bookings: Booking[];
  tablesLeft: number;
  isFull: boolean;
  /** Why the viewer cannot book, or null when they can. */
  blockedReason: string | null;
  /**
   * Which rule stopped them. "full" is the only one a waiting list can help
   * with — someone at their booking limit cannot be promoted off a queue
   * either, so offering them one would be a dead end.
   */
  blockedBy: "not-a-member" | "date-clash" | "booking-limit" | "full" | null;
  /** The viewer already has a booking on this date, at any session. */
  viewerBookedThisDate: boolean;
  /**
   * Whether an advert may be posted for this night.
   *
   * A tier only lets a member advertise a set number of club nights ahead. The
   * page used to offer "Find an opponent" on every night and let the server
   * refuse it, which read as a broken feature rather than a rule: a tester
   * clicked the fourth Thursday, got told it was outside their window, and
   * logged the whole feature as untestable.
   */
  canPostLookingForGame: boolean;
};

export type BookingCalendar = {
  clubId: number;
  clubSlug: string;
  clubName: string;
  /** Null when the club takes no bookings at all. */
  settings: {
    price: string;
    priceValue: number;
    currency: string;
    horizonDays: number;
    enforceAdvanceWindow: boolean;
    cancelCutoffHours: number;
    waitlistEnabled: boolean;
    lookingForGamesEnabled: boolean;
  } | null;
  capacity: number;
  sessions: CalendarSession[];
  /**
   * The nights this viewer could actually book, oldest first, each date once.
   *
   * The looking-for-a-game window is counted in these rather than in calendar
   * nights, so the button and the server rule have to read the same list or
   * they disagree the moment a night fills up.
   */
  bookableDates: string[];
  /** How many future bookings the viewer already holds here. */
  viewerUpcoming: number;
  viewerCanBook: boolean;
  benefits: MembershipBenefits;
};
