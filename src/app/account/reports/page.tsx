import { redirect } from "next/navigation";
import PageHead from "@/components/ui/PageHead";
import MyReports from "@/components/account/MyReports";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyReports, readMyReportFilters } from "@/services/myReports.service";

export const metadata = { title: "Things you reported" };

/**
 * What you reported, and what came of it.
 *
 * 0122 built the admin's side and stopped there, so reporting was a thing you
 * did into silence: the page looked the same afterwards, nothing listed what
 * you had raised, and when an admin decided you were never told. This is the
 * other end of it, and the bell now links here.
 */
export default async function MyReportsPage({
  searchParams,
}: PageProps<"/account/reports">) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/reports");

  const filters = readMyReportFilters(await searchParams);
  const page = await getMyReports(filters);

  return (
    <>
      <PageHead
        title="Things you reported"
        lede="What you sent in, and what the club or a site admin decided. The person who wrote it is never told who reported them, so this list is only ever yours."
      />
      <MyReports page={page} tab={filters.tab} type={filters.type}
        query={filters.query} sort={filters.sort} />
    </>
  );
}
