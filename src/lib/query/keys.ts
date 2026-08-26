/** Structured query keys so invalidation is reliable. Never inline these at call sites. */

/** Names match the legacy API's query parameters so URLs stay portable. */
export type ClubListFilters = {
  q?: string;
  city?: string;
  format?: string;
  day?: string;
  location?: string;
  withinMiles?: string;
  reviewRating?: string;
  sort?: string;
  page?: number;
  /** Map view asks for every match; the list stays paginated. */
  pageSize?: number;
};

export const clubKeys = {
  all: ["clubs"] as const,
  lists: () => [...clubKeys.all, "list"] as const,
  list: (filters: ClubListFilters) => [...clubKeys.lists(), filters] as const,
  details: () => [...clubKeys.all, "detail"] as const,
  detail: (slug: string) => [...clubKeys.details(), slug] as const,
};

export const taxonomyKeys = {
  all: ["taxonomy"] as const,
  formats: () => [...taxonomyKeys.all, "formats"] as const,
  games: () => [...taxonomyKeys.all, "games"] as const,
  facilities: () => [...taxonomyKeys.all, "facilities"] as const,
};
