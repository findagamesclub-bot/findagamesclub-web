import { NextResponse, type NextRequest } from "next/server";
import { listClubs } from "@/services/clubs.service";

/** Backs client-side filtering. Parameter names match the legacy API. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const value = (key: string) => p.get(key) ?? undefined;

  try {
    return NextResponse.json(
      await listClubs({
        q: value("q"),
        city: value("city"),
        format: value("format"),
        day: value("day"),
        location: value("location"),
        withinMiles: value("withinMiles"),
        reviewRating: value("reviewRating"),
        sort: value("sort"),
        page: Number(p.get("page") ?? 1),
        pageSize: p.get("pageSize") ? Number(p.get("pageSize")) : undefined,
      }),
    );
  } catch (error) {
    console.error("clubs list failed", error);
    return NextResponse.json({ error: "Could not load clubs." }, { status: 500 });
  }
}
