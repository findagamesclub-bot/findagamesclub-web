import "server-only";

import { createAnonClient } from "@/lib/supabase/anon";
import { table } from "@/lib/supabase/table";

/**
 * The one settings row.
 *
 * Shimmed because `site_settings` arrived with 0098 and the generated types do
 * not carry it yet. Delete the shim once they are regenerated.
 */
export type SiteSettingsRow = {
  id: number;
  contact_email: string;
  terms_md: string;
  privacy_md: string;
  cookies_md: string;
  updated_at: string;
};

const COLUMNS = "id, contact_email, terms_md, privacy_md, cookies_md, updated_at";

/**
 * Read the row.
 *
 * Deliberately sessionless. This is the same four strings for every visitor,
 * the service caches it, and Next refuses `cookies()` inside a cache scope, so
 * attaching a session here would mean the cached read threw on every request
 * and the legal pages silently fell back to their placeholder forever. RLS
 * still applies: the row comes back because `anon` may select it.
 */
export async function findSiteSettings(): Promise<SiteSettingsRow | null> {
  const supabase = createAnonClient();
  const { data, error } = await (supabase as unknown as {
    from(name: string): {
      select(columns: string): {
        eq(column: string, value: number): {
          maybeSingle(): Promise<{ data: SiteSettingsRow | null; error: { message: string } | null }>;
        };
      };
    };
  }).from("site_settings").select(COLUMNS).eq("id", 1).maybeSingle();

  if (error) throw new Error(`Failed to load site settings: ${error.message}`);
  return data;
}

/**
 * Change one or more of them.
 *
 * The zero-row pattern: RLS lets only an admin through, and a filtered-out
 * update returns 204 with no error, so the absence of a row is the refusal.
 * Acting on the row that comes back rather than re-reading keeps it that way.
 */
export async function saveSiteSettings(
  patch: Partial<Pick<SiteSettingsRow, "contact_email" | "terms_md" | "privacy_md" | "cookies_md">>,
): Promise<SiteSettingsRow> {
  const settings = await table<SiteSettingsRow>("site_settings");
  const { data, error } = await settings
    .update(patch)
    .eq("id", 1)
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}
