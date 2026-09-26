import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import PeriodTabs from "./PeriodTabs";
import AnalyticsSection from "./AnalyticsSection";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getClubAnalytics } from "@/services/analytics.service";
import { londonNow } from "@/utils/dates";
import { DEFAULT_PERIOD, PERIODS, readPeriod } from "@/utils/analytics-period";
import { ANALYTICS_TABS, DEFAULT_TAB, readTab, readsFor } from "@/utils/analytics-tabs";
import { nextSearch, searchFrom, withSearch } from "@/utils/filter-url";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Analytics" };

/**
 * How the club is doing, a section at a time.
 *
 * The client asked for "club dashboard and reporting (see local app for full
 * details on all reporting)", so legacy is the spec and this is its 24 sections
 * grouped into six that each answer a question somebody actually asks.
 *
 * Six tabs rather than one long scroll. It was one page with a jump-to nav and
 * the client asked for tabs, which is also what the rest of the console does.
 * It costs less as well: the page reads the one thing the open tab renders, so
 * opening Money is one round trip rather than six.
 *
 * Two range pickers, because legacy keeps the trend on its own range and a club
 * reading this month's takings against a year of shape is a real thing to want.
 * Both live in the address, so a window is a link.
 */
export default async function ClubAnalyticsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/analytics">) {
  const { slug } = await params;
  const query = await searchParams;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/analytics`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("analytics.view")) notFound();

  const tab = readTab(query.tab);
  const period = readPeriod(query.period);
  const trend = readPeriod(query.trend);
  const today = londonNow().date;

  const data = await getClubAnalytics(club.id, period, today, readsFor(tab), trend);

  const here = `/clubs/${slug}/manage/analytics`;
  const at = (changes: Record<string, string>, defaults: Record<string, string>) =>
    withSearch(here, nextSearch(searchFrom(query), changes, defaults));

  // Built here, as strings. A function handed to a client component throws on
  // every request, and nothing before opening the page catches it.
  const windows = (param: string) => PERIODS.map((one) => ({
    key: one.key, label: one.label,
    href: at({ [param]: one.key }, { [param]: DEFAULT_PERIOD }),
  }));

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Analytics"
        lede="Who is turning up, what came in, and which nights fill. Every figure is for the window you pick, and nothing here leaves the club."
      />

      {data.missing > 0 ? (
        <Box sx={{ mb: 2, p: 2, borderRadius: 1.5,
                   border: `1px solid ${tokens.danger}`, backgroundColor: tokens.paper }}>
          <Typography variant="body2">
            This section did not load, so everything in it reads zero. That is
            not a quiet month: nothing was counted at all. Check the database is
            reachable and that the latest migrations have been run.
          </Typography>
        </Box>
      ) : null}

      <PeriodTabs label="Window" value={period} options={windows("period")} />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Which part of the club to look at"
          value={tab}
          tabs={ANALYTICS_TABS.map((one) => ({
            value: one.key, label: one.label,
            href: at({ tab: one.key }, { tab: DEFAULT_TAB }),
          }))}
        />
      </Box>

      <Stack spacing={0}>
        <AnalyticsSection
          tab={tab}
          data={data}
          slug={slug}
          period={period}
          trend={trend}
          trendWindows={windows("trend")}
        />
      </Stack>
    </Container>
  );
}
