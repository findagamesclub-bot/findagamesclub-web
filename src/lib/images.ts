import { fitWithin, MAX_EDGE } from "@/utils/club-media";

/**
 * Redraw a file no wider than `edge`, as WebP.
 *
 * A phone camera produces 4000px and 8MB, the bucket refuses anything over
 * 5MB, and nothing on the site renders wider than 1200. Uploading the original
 * would fail on exactly the phones most likely to be used on a club night.
 *
 * Browser code rather than a util, because it needs a canvas. Falls back to the
 * original if the browser cannot decode it, so an unusual file fails at the
 * bucket with a clear message rather than here with none.
 */
export async function downscaleImage(file: File, edge = MAX_EDGE): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, edge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}
