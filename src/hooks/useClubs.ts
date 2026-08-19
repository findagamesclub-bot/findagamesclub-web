"use client";

import { useQuery } from "@tanstack/react-query";
import { clubKeys, type ClubListFilters } from "@/lib/query/keys";
import type { ClubSummary } from "@/types/club";

export type ClubListResponse = {
  clubs: ClubSummary[];
  total: number;
  page: number;
  pageSize: number;
  origin: { label: string } | null;
  /** Set when a place was searched for but could not be found. */
  locationUnresolved?: boolean;
};

function toSearchParams(filters: ClubListFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export function useClubs(filters: ClubListFilters, initialData?: ClubListResponse) {
  return useQuery({
    queryKey: clubKeys.list(filters),
    queryFn: async (): Promise<ClubListResponse> => {
      const response = await fetch(`/api/clubs?${toSearchParams(filters)}`);
      if (!response.ok) throw new Error("Could not load clubs.");
      return response.json();
    },
    // The server already rendered page one; don't refetch it on mount.
    initialData,
    placeholderData: (previous) => previous,
  });
}
