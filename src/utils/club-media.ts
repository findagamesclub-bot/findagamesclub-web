/**
 * A club's photos: where they go, and what is allowed.
 *
 * Pure so the rules can be tested and so the same numbers reach the form, the
 * hook and the copy. What actually enforces them is the storage policy and the
 * trigger in 0087; these are the same rules said early enough to be useful.
 */

export const CLUB_MEDIA = "club-media";

/** Legacy's own limit: `_normalise_images(..., limit=10)`. */
export const MAX_CLUB_IMAGES = 10;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The bucket's limit, checked here so a phone is told before it uploads. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * The longest edge we keep.
 *
 * Nothing on the site renders a club photo wider than 1200, and phone cameras
 * produce 4000. Downscaling before the upload turns an 8MB file into a few
 * hundred KB, which is the difference between working on a club night and
 * timing out on it.
 */
export const MAX_EDGE = 1600;

export type MediaKind = "logo" | "photos" | "shop" | "events";

/**
 * `clubs/<club id>/<kind>/<uuid>.<ext>`
 *
 * The club id is the second folder because that is what the storage policy
 * reads to decide whether the writer runs this club.
 */
export function clubMediaPath(
  clubId: number, kind: MediaKind, fileName: string, unique: string,
): string {
  return `clubs/${clubId}/${kind}/${unique}.${extensionOf(fileName)}`;
}

/** The extension, trusting nothing about the name the browser handed us. */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return (dot > -1 ? fileName.slice(dot + 1) : "")
    .toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
}

/**
 * `submissions/<submission id>/<kind>/<uuid>.<ext>`
 *
 * Where a photo goes while the club it belongs to does not exist yet. 0160's
 * storage policy reads folder 2 the same way 0087 reads a club's, and asks the
 * question `club_submissions_edit` asks instead of `club_can`.
 *
 * Approving moves these across into the club's own folder, because a club has
 * to be able to delete its own photographs and the club policy only ever
 * matches `clubs/<id>/`.
 */
export function submissionMediaPath(
  submissionId: number, kind: MediaKind, fileName: string, unique: string,
): string {
  return `submissions/${submissionId}/${kind}/${unique}.${extensionOf(fileName)}`;
}

/** Whichever of the two a builder step is pointed at. */
export type MediaOwner =
  | { kind: "club"; id: number }
  | { kind: "submission"; id: number };

/** The path for a file, wherever this builder happens to be writing. */
export function mediaPathFor(
  owner: MediaOwner, kind: MediaKind, fileName: string, unique: string,
): string {
  return owner.kind === "club"
    ? clubMediaPath(owner.id, kind, fileName, unique)
    : submissionMediaPath(owner.id, kind, fileName, unique);
}

/** Whether a path names a file this owner may name for deletion. */
export function isOwnMediaPath(path: string, owner: MediaOwner): boolean {
  const parts = path.split("/");
  const root = owner.kind === "club" ? "clubs" : "submissions";
  return parts.length >= 3
    && parts[0] === root
    && parts[1] === String(owner.id)
    && parts.every((part) => part !== "" && part !== "." && part !== "..");
}

/** Why this file cannot be used, in words for the person holding it. */
export function rejectImage(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "That has to be a JPEG, PNG or WebP.";
  }
  // After downscaling almost nothing trips this; it is here for a file that is
  // huge before it is wide, such as a screenshot of a screenshot.
  if (file.size > MAX_IMAGE_BYTES) {
    return "That file is over 5MB, even after resizing.";
  }
  return null;
}

/** The size to draw at, keeping the shape. */
export function fitWithin(width: number, height: number, edge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= edge) return { width, height };
  const scale = edge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}


/**
 * The URL for an image row, whichever way it was stored.
 *
 * Two kinds sit in `club_images`: rows imported from the old site, which carry
 * an absolute `src` to a file nobody here owns, and rows uploaded through the
 * editor, which carry a `storage_path` into our own bucket. One mapper, because
 * every screen that shows a club photo has to handle both and none of them
 * should have to know that.
 */
export function clubImageUrl(
  image: { src?: string | null; storagePath?: string | null },
  publicUrl: (bucket: string, path: string) => string,
): string {
  const path = image.storagePath?.trim();
  if (path) return publicUrl(CLUB_MEDIA, path);
  return image.src?.trim() ?? "";
}

/**
 * The URL for a club's logo, whichever way it was stored.
 *
 * Same two-column shape as `clubImageUrl` and for the same reason: eleven
 * clubs came across from the old site with an absolute `logo_url` to a file
 * nobody here owns, and a logo uploaded through the builder lands in our own
 * bucket as `logo_path`. Ours wins where both are set, because that is the one
 * the club chose most recently.
 *
 * `ClubLogo` renders this in about twenty places and reads one field, so the
 * resolving happens once at the service boundary rather than at every call.
 */
export function clubLogoUrl(
  club: { logoPath?: string | null; logoUrl?: string | null },
  publicUrl: (bucket: string, path: string) => string,
): string | null {
  const path = club.logoPath?.trim();
  if (path) return publicUrl(CLUB_MEDIA, path);
  return club.logoUrl?.trim() || null;
}

/**
 * Whether a path names a file in this club's own folder.
 *
 * The list of files to delete comes back through the form, so it is checked
 * against the club being saved before anything acts on it. The storage policy
 * says the same thing; this is the cheaper half of saying it twice.
 */
export function isClubMediaPath(path: string, clubId: number): boolean {
  const parts = path.split("/");
  return parts.length >= 3
    && parts[0] === "clubs"
    && parts[1] === String(clubId)
    && parts.every((part) => part !== "" && part !== "." && part !== "..");
}
