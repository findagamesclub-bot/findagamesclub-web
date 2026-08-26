"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubFilters, { type FilterOptions } from "./ClubFilters";
import ClubGrid, { ClubGridSkeleton } from "./ClubGrid";
import ClubMapView from "@/components/map/ClubMapView";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import MapIcon from "@mui/icons-material/Map";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useClubs, type ClubListResponse } from "@/hooks/useClubs";
import type { ClubListFilters } from "@/lib/query/keys";
import { tokens } from "@/lib/tokens";

type Props = {
  initialFilters: ClubListFilters;
  initialData: ClubListResponse;
  options: FilterOptions;
};

export default function ClubDirectory({
  initialFilters, initialData, options,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<ClubListFilters>(initialFilters);
  const searchParams = useSearchParams();
  const view: "list" | "map" = searchParams.get("view") === "map" ? "map" : "list";

  // A map showing page one of the matches would be a map that lies about where
  // clubs are, so map view asks for the whole matching set.
  const query = useMemo<ClubListFilters>(
    () => (view === "map" ? { ...filters, page: 1, pageSize: 500 } : filters),
    [filters, view],
  );

  // Only page one was server-rendered, so only page one seeds the cache.
  const seed = useMemo(
    () => (JSON.stringify(query) === JSON.stringify(initialFilters) ? initialData : undefined),
    [query, initialFilters, initialData],
  );

  const { data, isFetching, isError } = useClubs(query, seed);

  // Keep the URL in step so a filtered view can be shared or bookmarked.
  const syncUrl = useCallback(
    (next: ClubListFilters) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        if (value !== undefined && value !== "" && !(key === "page" && value === 1)) {
          params.set(key, String(value));
        }
      }
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [pathname, router],
  );

  const update = useCallback(
    (patch: Partial<ClubListFilters>) => {
      // Any filter change invalidates the current page number.
      const next = { ...filters, ...patch, page: patch.page ?? 1 };
      setFilters(next);
      syncUrl(next);
    },
    [filters, syncUrl],
  );

  const setView = useCallback(
    (next: "list" | "map") => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "map") params.set("view", "map");
      else params.delete("view");
      const query = params.toString();
      startTransition(() =>
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => {
    const next: ClubListFilters = { sort: filters.sort, page: 1 };
    setFilters(next);
    syncUrl(next);
  }, [filters.sort, syncUrl]);

  const clubs = data?.clubs ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / (data?.pageSize ?? 12)));

  return (
    <Stack spacing={3}>
      <ClubFilters
        filters={filters}
        options={options}
        resultCount={total}
        page={filters.page ?? 1}
        pageCount={pageCount}
        onChange={update}
        onClear={clear}
      />

      <Stack direction="row" spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: tokens.inkMuted }}>
          {total} {total === 1 ? "club" : "clubs"}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, next) => { if (next) setView(next); }}
          aria-label="How to show the results"
        >
          <ToggleButton value="list" aria-label="List view">
            <FormatListBulletedIcon sx={{ fontSize: 17, mr: 0.75 }} />
            List
          </ToggleButton>
          <ToggleButton value="map" aria-label="Map view">
            <MapIcon sx={{ fontSize: 17, mr: 0.75 }} />
            Map
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {data?.origin ? (
        <Typography variant="overline" color="text.secondary" aria-live="polite">
          Measured from {data.origin.label}
        </Typography>
      ) : null}

      {isError ? (
        <ErrorState message="We could not reach the directory. Your filters are still here." />
      ) : isFetching && clubs.length === 0 ? (
        <ClubGridSkeleton />
      ) : data?.locationUnresolved ? (
        // Naming the place matters: the alternative is a generic empty state
        // after a search that looked like it worked.
        <EmptyState
          title={`We could not find "${filters.location}"`}
          description="Try a town, county or postcode, like Didcot, Oxfordshire or OX11."
          // Clearing only the place. Sending them to the bare path would throw
          // away the game and day they had already chosen.
          onAction={{ label: "Clear the location", onClick: () => update({ location: "", withinMiles: "" }) }}
        />
      ) : clubs.length === 0 ? (
        <EmptyState
          title="No clubs match those filters"
          description={
            filters.q
              ? "Try a game like Warhammer 40,000, a facility like parking, or part of a club's name."
              : "Try widening the distance, or clear the filters to see everywhere."
          }
          action={{ label: "Clear filters", href: pathname }}
        />
      ) : (
        // Results stay on screen while refetching rather than flashing empty,
        // but dim and stop responding so it is obvious they are out of date.
        <BusyOverlay busy={isFetching} variant="dim" label="Updating results">
          {view === "map" ? <ClubMapView clubs={clubs} /> : <ClubGrid clubs={clubs} />}
        </BusyOverlay>
      )}

      {view === "list" && pageCount > 1 ? (
        <Stack sx={{ alignItems: "center", pt: 1 }}>
          <Pagination
            count={pageCount}
            page={filters.page ?? 1}
            onChange={(_, page) => {
              update({ page });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            shape="rounded"
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
