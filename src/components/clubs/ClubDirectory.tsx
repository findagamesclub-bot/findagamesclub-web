"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubFilters, { type FilterOptions } from "./ClubFilters";
import ClubGrid, { ClubGridSkeleton } from "./ClubGrid";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useClubs, type ClubListResponse } from "@/hooks/useClubs";
import type { ClubListFilters } from "@/lib/query/keys";

type Props = {
  initialFilters: ClubListFilters;
  initialData: ClubListResponse;
  options: FilterOptions;
};

export default function ClubDirectory({ initialFilters, initialData, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<ClubListFilters>(initialFilters);

  // Only page one was server-rendered, so only page one seeds the cache.
  const seed = useMemo(
    () => (JSON.stringify(filters) === JSON.stringify(initialFilters) ? initialData : undefined),
    [filters, initialFilters, initialData],
  );

  const { data, isFetching, isError } = useClubs(filters, seed);

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

      {data?.origin ? (
        <Typography variant="overline" color="text.secondary" aria-live="polite">
          Measured from {data.origin.label}
        </Typography>
      ) : null}

      {isError ? (
        <ErrorState message="We could not reach the directory. Your filters are still here." />
      ) : isFetching && clubs.length === 0 ? (
        <ClubGridSkeleton />
      ) : clubs.length === 0 ? (
        <EmptyState
          title="No clubs match those filters"
          description="Try a different town, or clear the filters to see everywhere."
          action={{ label: "Clear filters", href: pathname }}
        />
      ) : (
        <ClubGrid clubs={clubs} />
      )}

      {pageCount > 1 ? (
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
