"use client";

import { createContext, useContext, useMemo, useTransition, type ReactNode } from "react";
import BusyOverlay from "@/components/ui/BusyOverlay";

/**
 * The loading state shared by the filter bar and the results.
 *
 * The club directory gets this for free: it fetches through TanStack Query, so
 * `isFetching` is right there beside the grid. The events directory renders on
 * the server, so the only signal is the transition the filter bar starts, and
 * the thing that needs to show it is somewhere else on the page. Hence a
 * context rather than local state.
 *
 * `dim` rather than `scrim`, matching clubs: the results underneath are still
 * true, they are only going out of date. Covering them would be a lie.
 */
type BusyValue = { busy: boolean; run: (fn: () => void) => void };

const EventsBusyContext = createContext<BusyValue>({ busy: false, run: (fn) => fn() });

export function useEventsBusy(): BusyValue {
  return useContext(EventsBusyContext);
}

export function EventsBusyProvider({ children }: { children: ReactNode }) {
  const [busy, startTransition] = useTransition();
  const value = useMemo<BusyValue>(
    () => ({ busy, run: (fn) => startTransition(fn) }),
    [busy],
  );
  return <EventsBusyContext.Provider value={value}>{children}</EventsBusyContext.Provider>;
}

/** Wraps whatever the filters are filtering. */
export function EventResults({ children }: { children: ReactNode }) {
  const { busy } = useEventsBusy();
  return (
    <BusyOverlay busy={busy} variant="dim" label="Updating results">
      {children}
    </BusyOverlay>
  );
}
