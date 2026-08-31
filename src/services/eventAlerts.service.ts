import "server-only";

import * as repo from "@/repositories/eventAlerts.repository";
import type { AlertFilters } from "@/repositories/eventAlerts.repository";

/**
 * Saved event searches.
 *
 * Legacy calls this "Save alert" on the directory: keep the search, hear when
 * something matching turns up. Storing the filters rather than the results is
 * the whole point — the answer is meant to change.
 */

const DUPLICATE = "23505";

export type SavedAlert = { id: number; label: string; filters: AlertFilters };

export async function getMyAlerts(profileId: string): Promise<SavedAlert[]> {
  try {
    const rows = await repo.findMyAlerts(profileId);
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      filters: (r.filters ?? {}) as AlertFilters,
    }));
  } catch {
    // A missing table must not take the events page down with it.
    return [];
  }
}

export async function saveAlert(
  profileId: string, label: string, filters: AlertFilters,
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const clean = label.trim().slice(0, 80);
  if (!clean) return { ok: false, error: "Give the alert a name so you can recognise it later." };

  // An empty search would alert on every event ever listed, which is not an
  // alert, it is the directory.
  const kept = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v && v.trim()),
  ) as AlertFilters;

  // A radius with nothing to measure from means nothing, and would be applied
  // as a real filter when the alert runs. The bar already says it needs a
  // location; this makes sure a saved alert cannot carry the broken pair.
  if (!kept.location) delete kept.withinMiles;

  if (!Object.keys(kept).length) {
    return { ok: false, error: "Set at least one filter first. An empty search matches everything." };
  }

  try {
    const row = await repo.insertAlert(profileId, clean, kept);
    return { ok: true, label: row.label };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes(DUPLICATE) || raw.includes("one_per_search")) {
      return { ok: false, error: "You have already saved this search." };
    }
    if (raw.includes("NOT_PERMITTED")) {
      return { ok: false, error: "Sign in again and try saving that alert." };
    }
    // "Try again" is a dead end when the table is not there — trying again does
    // the same thing. Say what is actually true and log the rest.
    if (raw.includes("club_event_alerts") || raw.includes("PGRST205") || raw.includes("42P01")) {
      return { ok: false, error: "Alerts are not switched on yet. Migration 0023 has not been applied." };
    }
    console.error("saving an event alert failed", { error });
    return { ok: false, error: "Could not save that alert. Try again." };
  }
}

export async function removeAlert(
  id: number, profileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await repo.deleteAlert(id, profileId);
    return { ok: true };
  } catch {
    return { ok: false, error: "That alert is not yours to delete." };
  }
}
