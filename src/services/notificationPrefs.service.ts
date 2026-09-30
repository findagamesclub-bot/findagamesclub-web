import "server-only";

import * as repo from "@/repositories/notificationPrefs.repository";
import {
  FAMILIES, FAMILY_META, defaultsFor, emailOffFamilies, kindsIn, type Family,
} from "@/utils/notification-families";

export type FamilySetting = {
  family: Family;
  label: string;
  detail: string;
  locked: string | null;
  bell: boolean;
  email: boolean;
  /** How many notification kinds this switch governs, for the screen to say. */
  covers: number;
};

/**
 * The six switches, in the order the screen shows them.
 *
 * Built from the defaults and then overlaid with whatever the member has
 * actually changed. A missing row is not an absence to work around: it is the
 * default, which is why nobody needs a backfill.
 */
export async function getMySettings(): Promise<FamilySetting[]> {
  const rows = await repo.findMyPreferences();
  const saved = new Map(rows.map((row) => [row.family, row]));
  // The same function the sender asks, rather than a second reading of the
  // same rule. They disagreed once: the card applied the default and the
  // sender did not, so a family that defaults to off still sent email.
  const off = emailOffFamilies(rows);

  return FAMILIES.map((family) => {
    const meta = FAMILY_META[family];
    const fallback = defaultsFor(family);
    const row = saved.get(family);
    return {
      family,
      label: meta.label,
      detail: meta.detail,
      locked: meta.locked ?? null,
      bell: row?.bell ?? fallback.bell,
      email: !off.has(family),
      covers: kindsIn(family).length,
    };
  });
}

export const saveSetting = (family: Family, bell: boolean, email: boolean) =>
  repo.savePreference(family, bell, email);

export const readUnsubscribe = (token: string) => repo.resolveToken(token);

export async function unsubscribe(token: string) {
  const family = await repo.applyUnsubscribe(token);
  return family ? { family, label: FAMILY_META[family].label } : null;
}
