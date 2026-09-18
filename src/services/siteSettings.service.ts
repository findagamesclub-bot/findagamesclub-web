import "server-only";

import { unstable_cache, updateTag } from "next/cache";
import * as repo from "@/repositories/siteSettings.repository";

/**
 * The three settings the site itself has.
 *
 * Legacy keeps them in `app-settings.json` and reads the file on every request.
 * Here they are one row, and the read is cached: the contact address and the
 * legal text are on pages every visitor can reach, they change perhaps twice a
 * year, and a query per visitor to fetch the same four strings is the shape of
 * cost that only shows up once the site is busy. One query a minute however
 * many people are looking, and an edit publishes immediately through the tag
 * rather than waiting for the minute to pass.
 */

export const SITE_SETTINGS_TAG = "site-settings";

export type SiteSettings = {
  contactEmail: string;
  termsMd: string;
  privacyMd: string;
  cookiesMd: string;
  updatedAt: string | null;
};

/** What the pages show when nobody has written anything yet. */
const EMPTY: SiteSettings = {
  contactEmail: "", termsMd: "", privacyMd: "", cookiesMd: "", updatedAt: null,
};

const read = unstable_cache(
  async (): Promise<SiteSettings> => {
    const row = await repo.findSiteSettings();
    if (!row) return EMPTY;
    return {
      contactEmail: row.contact_email ?? "",
      termsMd: row.terms_md ?? "",
      privacyMd: row.privacy_md ?? "",
      cookiesMd: row.cookies_md ?? "",
      updatedAt: row.updated_at ?? null,
    };
  },
  ["site-settings"],
  { tags: [SITE_SETTINGS_TAG], revalidate: 60 },
);

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await read();
  } catch (error) {
    // A settings table that cannot be read must not take the terms page down
    // with it. The page falls back to its placeholder.
    console.error("[settings] could not be read", error);
    return EMPTY;
  }
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Change one of them.
 *
 * Only an admin gets through, and the policy is what says so: a filtered-out
 * update affects zero rows and returns no error, so the repository treats a
 * missing row as the refusal rather than reporting a save that never happened.
 */
export async function saveSiteSettings(patch: {
  contact_email?: string; terms_md?: string; privacy_md?: string; cookies_md?: string;
}): Promise<SaveResult> {
  try {
    await repo.saveSiteSettings(patch);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("NOT_PERMITTED") || raw.includes("row-level security")) {
      return { ok: false, error: "Only an admin can change the site settings." };
    }
    console.error("[settings] save failed", raw);
    return { ok: false, error: "Could not save that. Try again." };
  }

  // `updateTag` rather than `revalidateTag`: Next 16 draws the distinction and
  // this is the read-your-own-writes side of it. An admin who has just fixed
  // the terms page opens it and sees the fix, instead of being served the stale
  // copy while the new one loads behind them.
  updateTag(SITE_SETTINGS_TAG);
  return { ok: true };
}
