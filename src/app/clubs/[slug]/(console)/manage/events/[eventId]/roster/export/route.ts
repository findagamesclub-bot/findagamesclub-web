import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import { doorListCsv, getDoorList } from "@/services/eventRoster.service";

/**
 * The door list as a spreadsheet.
 *
 * A route rather than a client-side download so the capability is checked on
 * the server: the rows carry names, addresses and what people owe, and a file
 * built in the browser would need all of that sent there first.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> },
) {
  const { slug, eventId } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) return new NextResponse("Sign in first", { status: 401 });

  const club = await getClubDetail(slug);
  if (!club) return new NextResponse("Not found", { status: 404 });

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) return new NextResponse("Not found", { status: 404 });

  const event = await getEvent(club.id, Number(eventId));
  if (!event) return new NextResponse("Not found", { status: 404 });

  const rows = await getDoorList(event.id);
  const { filename, body } = doorListCsv({
    id: event.id, legacyId: event.legacyId, title: event.title,
    startDate: event.startDate || null, clubName: club.name, clubSlug: slug,
  }, rows);

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      // A door list is different every time somebody pays at the table.
      "cache-control": "no-store",
    },
  });
}
