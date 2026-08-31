/** The networks a member may list, in the order legacy shows them. */
export const SOCIAL_NETWORKS = [
  "Instagram", "Facebook", "Discord", "X", "TikTok", "YouTube", "Twitch",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type SocialLink = { label: string; url: string };

/**
 * Legacy stores these as an array of `{ label, url }` and so do we, rather
 * than a column per network: adding Bluesky should not be a migration.
 */
export function toSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { label, url } = entry as { label?: unknown; url?: unknown };
    const cleanLabel = String(label ?? "").trim();
    const cleanUrl = String(url ?? "").trim();
    return cleanLabel && cleanUrl ? [{ label: cleanLabel, url: cleanUrl }] : [];
  });
}

/** What a form field should start with for one network. */
export function socialValue(links: SocialLink[], network: string): string {
  return links.find((link) => link.label.toLowerCase() === network.toLowerCase())?.url ?? "";
}

/**
 * Tidy what somebody typed into something a browser will follow.
 *
 * People paste "instagram.com/joe" and type "@joe". A bare handle is not a
 * link and cannot be made into one without guessing the network's URL shape,
 * so it is rejected rather than silently turned into a broken link. A missing
 * scheme is added, because that is a typing habit rather than an error.
 */
export function normaliseSocialUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  // A host has to have a dot in it. This is what stops "@joe" and "joe"
  // becoming https://@joe, which every browser refuses to open.
  if (!parsed.hostname.includes(".")) return null;
  if (parsed.hostname.startsWith(".") || parsed.hostname.endsWith(".")) return null;

  return parsed.toString().replace(/\/$/, "");
}

/** Build the stored array from one field per network, dropping the blanks. */
export function buildSocialLinks(
  entries: { label: string; url: string }[],
): { links: SocialLink[]; rejected: string[] } {
  const links: SocialLink[] = [];
  const rejected: string[] = [];

  for (const entry of entries) {
    const url = normaliseSocialUrl(entry.url);
    if (!entry.url.trim()) continue;
    if (!url) {
      rejected.push(entry.label);
      continue;
    }
    links.push({ label: entry.label, url });
  }

  return { links, rejected };
}
