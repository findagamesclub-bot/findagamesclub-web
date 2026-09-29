import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSnapshot } from "@/services/armyCatalogue.service";

/**
 * One published catalogue version, as JSON.
 *
 * The builder and the result dialog read a faction at a time in stage 10, but
 * this is the whole thing: 936 KB uncompressed and far less over the wire, and
 * a published version never changes, so it is cached hard and served
 * `immutable`. A browser that has one never asks again.
 *
 * `unstable_cache` cannot contain `cookies()`, which the server client reads,
 * so the repository behind this uses the anon client. That is the trap 0104
 * documents: a cached read that throws falls back to an empty row and the page
 * shows a plausible lie rather than an error.
 */
const cached = (edition: string, version: string) =>
  unstable_cache(
    () => getSnapshot(edition, version),
    ["army-catalogue", edition, version],
    { tags: [`army-catalogue:${edition}`], revalidate: 3600 },
  )();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ edition: string; version: string }> },
) {
  const { edition, version } = await params;
  const catalogue = await cached(edition, version);

  if (!catalogue) {
    return NextResponse.json(
      { error: "No published catalogue with that version." },
      { status: 404 },
    );
  }

  return NextResponse.json(catalogue, {
    headers: {
      // A published version is frozen by the database, so this is safe to
      // promise. Anything that changes gets a new version rather than new
      // bytes under the same one.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
    },
  });
}
