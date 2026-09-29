"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogueKeys } from "@/lib/query/keys";
import type { Catalogue } from "@/utils/army-catalogue";

/**
 * The catalogue a club records against, fetched when somebody asks for it.
 *
 * Not passed down from the server: the published snapshot is close to a
 * megabyte, and putting it in the RSC payload of a page would make every
 * reader of a games list download a catalogue almost none of them open. The
 * route serves a frozen version with an `immutable` cache header, so the
 * second dialog on a page is free and so is the next visit.
 *
 * `enabled` is what keeps it lazy. The dialog passes its own open state, so
 * the request starts on the first open and never on a page that only lists
 * results.
 */
export function useCatalogue(
  builder: { editionId: string; catalogueVersion: string } | null | undefined,
  wanted: boolean,
) {
  const edition = builder?.editionId ?? "";
  const version = builder?.catalogueVersion ?? "";

  const query = useQuery({
    queryKey: catalogueKeys.version(edition, version),
    enabled: wanted && Boolean(edition && version),
    // A published version cannot change, so there is nothing to go stale.
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<Catalogue> => {
      const response = await fetch(
        `/api/army-catalogue/${encodeURIComponent(edition)}/${encodeURIComponent(version)}`);
      if (!response.ok) throw new Error("Could not load the army catalogue.");
      return response.json() as Promise<Catalogue>;
    },
  });

  return {
    catalogue: query.data ?? null,
    loading: query.isLoading,
    failed: query.isError,
  };
}
