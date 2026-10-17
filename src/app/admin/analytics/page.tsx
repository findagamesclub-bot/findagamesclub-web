import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import MonoLabel from "@/components/ui/MonoLabel";
import EmptyState from "@/components/ui/EmptyState";
import PeriodTabs from "@/app/clubs/[slug]/(console)/manage/analytics/PeriodTabs";
import GrowthStat from "@/components/admin/GrowthStat";
import DownloadButton from "@/components/ui/DownloadButton";
import SiteGrowthCharts from "@/components/admin/SiteGrowthCharts";
import { getSiteGrowth } from "@/services/siteGrowth.service";
import { PERIODS, periodLabel, readPeriod } from "@/utils/analytics-period";
import { GROWTH_SERIES, SITE_REVENUE } from "@/utils/site-growth";
import { pricePence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "How the site is doing" };

/** What to call the window before this one, in the sentence under a figure. */
const NOUN: Record<string, string> = {
  month: "month", "3m": "quarter", "6m": "six months",
  "12m": "year", all: "period",
};

/**
 * The site's own dashboard.
 *
 * Every club has had one since 0117 and the site had a count of how many clubs
 * exist. The client's words: "Admin would require their own set of analytics
 * and dashboards to track overall club listing and events growth over time
 * periods, revenue growth by revenue type."
 *
 * Deliberately the club console's own visual language rather than a new one:
 * the same window picker, the same mono figures, the same month chart. An
 * admin reading a club's dashboard and then the site's should not have to
 * learn two. What is new is the comparison, because growth is what this page
 * is for and a figure without one is a measurement.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: PageProps<"/admin/analytics">) {
  const query = await searchParams;
  const period = readPeriod(query.window);
  const { months, summary, failed, from, to } = await getSiteGrowth(period);

  const at = (next: string) =>
    next === "3m" ? "/admin/analytics" : `/admin/analytics?window=${next}`;

  const noun = NOUN[period] ?? "period";
  const now = summary?.now ?? {};
  const win = summary?.window ?? {};
  const was = summary?.before ?? {};

  return (
    <>
      <PageHead
        title="How the site is doing"
        lede="What the site gained over the window you pick, what it brought in, and how both compare with the window before."
      />

      <PeriodTabs
        label="WINDOW"
        value={period}
        options={PERIODS.map((p) => ({ key: p.key, label: p.label, href: at(p.key) }))}
      />

      {failed ? (
        <EmptyState title="The figures would not load"
          description="Nothing was read, so this is not a quiet quarter. Check the database is reachable and that the latest migrations have been run, then try again." />
      ) : (
        <Stack spacing={3}>
          {/* Where the site stands, which no window can answer: a run of
              months says how fast it is filling and not how full it is. */}
          <Stack direction="row" spacing={{ xs: 2.5, sm: 4.5 }} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "baseline",
                  py: 1.75, px: { xs: 2, sm: 2.5 }, borderRadius: 2,
                  border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
            {[
              { label: "Clubs live", value: now.liveClubs ?? 0 },
              { label: "Clubs in all", value: now.clubs ?? 0 },
              { label: "Accounts", value: now.accounts ?? 0 },
              { label: "Events to come", value: now.upcomingEvents ?? 0 },
            ].map((stat) => (
              <Stack key={stat.label} direction="row" spacing={1}
                sx={{ alignItems: "baseline" }}>
                <Typography sx={{ fontFamily: mono, fontSize: "1.5rem", fontWeight: 700,
                                  lineHeight: 1 }}>
                  {stat.value.toLocaleString("en-GB")}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                  letterSpacing: "0.1em", color: tokens.inkMuted }}>
                  {stat.label.toUpperCase()}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Box>
            <MonoLabel>{`Over ${periodLabel(period).toLowerCase()}`}</MonoLabel>
            <Box sx={{ display: "grid", gap: 2.5,
                       gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))",
                                              md: "repeat(5, minmax(0, 1fr))" } }}>
              {GROWTH_SERIES.map((s) => (
                <GrowthStat key={s.key} label={s.label} noun={noun}
                  value={Number(win[s.key] ?? 0)} before={Number(was[s.key] ?? 0)} />
              ))}
              {SITE_REVENUE.map((s) => (
                <GrowthStat key={s.key} label={s.label} noun={noun}
                  value={Number(win[s.key] ?? 0)} before={Number(was[s.key] ?? 0)}
                  format={(pence) => pricePence(pence)} />
              ))}
            </Box>

            {/* Said rather than left to be discovered. The two money figures
                are not the same kind of money and adding them into one total
                would be the page inventing a receipt. */}
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                              color: tokens.inkMuted, mt: 2 }}>
              {`Listing fees are payments recorded against a subscription. `
                + `Featured slots are what was booked at the price set, counted `
                + `from the day each slot starts: featuring is settled offline, `
                + `so there is no payment to record. The two are kept apart `
                + `rather than added up.`}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                              color: tokens.inkMuted, mt: 0.5 }}>
              {`Compared with ${shortDate(summary?.beforeFrom ?? "")} to `
                + `${shortDate(summary?.beforeTo ?? "")}. `
                + `This window is ${shortDate(from)} to ${shortDate(to)}.`}
            </Typography>
          </Box>

          <Box>
            <Stack direction="row" spacing={2}
              sx={{ alignItems: "baseline", justifyContent: "space-between",
                    flexWrap: "wrap" }}>
              <MonoLabel>Month by month</MonoLabel>
              {/* The ledger, not the chart. A tax return is made of lines, so
                  the file is one row per transaction with the date, the period
                  it bought, the renewal date, the club, the note and the
                  amount. It covers the window above it, which is what makes
                  the two checkable against each other. */}
              <DownloadButton variant="outlined" size="small"
                label="Download every transaction"
                href={`/admin/analytics/export?period=${period}`} />
            </Stack>
            <SiteGrowthCharts months={months} />
          </Box>
        </Stack>
      )}
    </>
  );
}
