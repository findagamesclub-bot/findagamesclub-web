/** Photos on a discussion post. Two at most, by the club's own rule. */
export const MAX_POST_IMAGES = 2;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** 5MB. A phone photo is 2 to 4, so this fits one without inviting a raw file. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type PostImage = { path: string; alt: string };

/** Whatever the column holds, reduced to pairs the page can render. */
export function toPostImages(value: unknown): PostImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const { path, alt } = entry as { path?: unknown; alt?: unknown };
      const clean = String(path ?? "").trim();
      return clean ? [{ path: clean, alt: String(alt ?? "").trim() }] : [];
    })
    .slice(0, MAX_POST_IMAGES);
}

/** Why a file cannot be attached, or null when it can. */
export function rejectImage(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "That file is not an image. JPEG, PNG, WebP and GIF work.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "That image is over 5MB. Most phones can send a smaller copy.";
  }
  return null;
}

/**
 * Where one person's uploads live.
 *
 * The first segment is their own id, which is what the storage policy checks:
 * somebody can write under their own folder and nobody else's.
 */
export function uploadPath(profileId: string, fileName: string, unique: string): string {
  // Only when there is a dot to take it from. "photo" split on "." returns
  // the whole name, which was becoming the extension.
  const dot = fileName.lastIndexOf(".");
  const extension = (dot > -1 ? fileName.slice(dot + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5) || "jpg";

  return `${profileId}/${unique}.${extension}`;
}
