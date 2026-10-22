import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import TableBookingsBoard from "./TableBookingsBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getTableBookings } from "@/services/clubTableBookings.service";
import { clubIdentity } from "@/utils/club-identity";
import { isTableSort, isTableTab } from "@/utils/table-bookings";

export const metadata = { title: "Table payments" };

/**
 * Who still owes the club for a table.
 *
 * The night calendar at `/clubs/<slug>/bookings` answers "who is playing on
 * Thursday" and is the screen the club manages a night from. It cannot answer
 * the question the client asked, because the question is not about a night:
 * *"we currently have no method to mark applicable table bookings as paid and
 * with notes ... it would be useful to be able to filter a view based on paid
 * or unpaid status"*.
 *
 * Its own entry in the rail rather than a tab on the calendar, and named for
 * money rather than for nights, so the two do not read as the same screen
 * twice. Fifth label to need that care after roster, pairings, listings and
 * the army pair.
 */
export default async function TablePaymentsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/bookings">) {
  const { slug } = await params;
  const query = await searchParams;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/bookings`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  // The same capability the night calendar's own console view asks for, so a
  // helper who runs the door can chase the money for it.
  if (!access.can("bookings.manage")) notFound();

  const one = (key: string) => {
    const value = query[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  // Bound before the guard rather than called twice: a type guard narrows the
  // value it was handed, not the next call that happens to return the same
  // string.
  const asked = one("state");
  const order = one("sort");
  const tab = isTableTab(asked) ? asked : "all";
  const sort = isTableSort(order) ? order : "newest";
  const search = one("q").trim();
  const month = one("month").trim();
  const page = Number(one("page")) || 1;

  const view = await getTableBookings(club.id, { tab, sort, query: search, month, page });

  const { faction } = clubIdentity(club.slug, club.name);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Table payments"
        lede="Every table booked at your club, and what was paid for it. Narrow it to a month to see what one of them took. Nothing here takes money, so this is the record of what happened at the door."
      />
      <TableBookingsBoard
        slug={slug}
        faction={faction}
        view={view}
        filters={{ tab, sort, query: search, month, page }}
      />
    </Container>
  );
}
