import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import PaymentsIcon from "@mui/icons-material/Payments";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import TimelineIcon from "@mui/icons-material/Timeline";
import Section from "@/components/ui/Section";
import StatTiles from "@/components/ui/StatTiles";
import DownloadButton from "@/components/ui/DownloadButton";
import PeriodTabs from "./PeriodTabs";
import AnalyticsCharts from "./AnalyticsCharts";
import PeopleLists from "./PeopleLists";
import type { ClubAnalytics } from "@/services/analytics.service";
import type { AnalyticsTabKey } from "@/utils/analytics-tabs";
import type { PeriodKey } from "@/utils/analytics-period";
import { periodLabel } from "@/utils/analytics-period";
import { totalMoney } from "@/services/analytics.service";
import { formatPounds } from "@/utils/format";
import { tokens } from "@/lib/tokens";

/** Whichever section the open tab asked for. One of six, never two. */
export default function AnalyticsSection({
  tab, data, slug, period, trend, trendWindows,
}: {
  tab: AnalyticsTabKey;
  data: ClubAnalytics;
  slug: string;
  period: PeriodKey;
  trend: PeriodKey;
  trendWindows: { key: string; label: string; href: string }[];
}) {
  const pounds = (value: number) => formatPounds(Number(value ?? 0));

  if (tab === "headline") {
    const s = data.summary;
    return (
      <Section flush title="The headline" icon={GroupsIcon}
        note={`${periodLabel(period)}, against a roster of ${s.members}.`}>
        <StatTiles tiles={[
          { label: "Active members", value: String(s.activeMembers),
            note: `${s.activeRate}% of the roster did something`,
            emphasis: s.activeMembers > 0 },
          { label: "New members", value: String(s.newMembers),
            note: "Approved inside the window" },
          { label: "Table bookings", value: String(s.tableBookings),
            note: "Places taken on club nights" },
          { label: "Event tickets", value: String(s.eventTickets),
            note: "Bought inside the window" },
          { label: "Posts", value: String(s.posts),
            note: "Threads started on the board" },
          { label: "Replies", value: String(s.replies),
            note: "Answers to those threads" },
        ]} />

        {/* The people who turn up without joining. They used to be counted as
            members, which is how a roster of two showed four active and read
            200%. They are worth knowing about, so they are said plainly. */}
        {s.activeVisitors > 0 ? (
          <Typography variant="body2" sx={{ mt: 2, color: tokens.inkMuted }}>
            Another {s.activeVisitors}{" "}
            {s.activeVisitors === 1 ? "person" : "people"} booked, bought or
            posted without being a member. They are the ones worth asking to
            join.
          </Typography>
        ) : null}
      </Section>
    );
  }

  if (tab === "money") {
    const money = totalMoney(data.money);
    return (
      <Section flush title="Money in" icon={PaymentsIcon}
        note="Gross is before discounts, net is what arrived. Both, because the gap is what loyalty and tiers cost you."
        action={(
          <DownloadButton variant="outlined" size="small"
            href={`/clubs/${slug}/manage/analytics/export/revenue?period=${period}`} />
        )}>
        <StatTiles columns={3} tiles={[
          { label: "Gross", value: pounds(money.gross), note: "Before any discount" },
          { label: "Net", value: pounds(money.net),
            note: "What actually came in", emphasis: money.net > 0 },
          { label: "Discounts", value: pounds(money.discounts),
            note: "Loyalty and tier, together" },
        ]} />

        <Box sx={{ mt: 2 }}>
          <Stack spacing={0.75}>
            {([
              ["Memberships", data.money.membership],
              ["Table bookings", data.money.tables],
              ["Event tickets", data.money.tickets],
              ["Shop", data.money.shop],
            ] as const).map(([label, stream]) => (
              <Stack key={label} direction="row" spacing={2}
                sx={{ justifyContent: "space-between", py: 0.75,
                      borderBottom: `1px solid ${tokens.rule}`,
                      "&:last-of-type": { borderBottom: 0 } }}>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {pounds(stream.gross)} gross · <strong>{pounds(stream.net)} net</strong>
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Loyalty is not revenue, so it sits under the streams rather than in
            them. Points spent are already inside the gap between gross and net
            above; showing them as income would count them twice. */}
        {data.money.points.earned > 0 || data.money.points.spent > 0 ? (
          <Typography variant="body2" sx={{ mt: 2, color: tokens.inkMuted }}>
            Loyalty over the same window: {data.money.points.earned} points
            earned, {data.money.points.spent} spent. What that cost you is
            already inside the discounts above.
          </Typography>
        ) : null}
      </Section>
    );
  }

  if (tab === "trend") {
    return (
      <Section flush title="Over the months" icon={TimelineIcon}
        note="Empty months are shown as zero rather than skipped, so a quiet August reads as quiet rather than missing.">
        <PeriodTabs label="Trend window" value={trend} options={trendWindows} />
        <AnalyticsCharts months={data.months} />
      </Section>
    );
  }

  if (tab === "people") {
    return (
      <Section flush title="Who is turning up" icon={GroupsIcon}
        note="Dropped off means somebody who was busy in the window before this one and has done nothing in it. They are still reachable.">
        <PeopleLists people={data.people} />
      </Section>
    );
  }

  if (tab === "nights") {
    return (
      <Section flush title="Nights and events" icon={EventSeatIcon}
        note="Sell-through is against the places the club put on sale, not against what sold.">
        <AnalyticsCharts nights={data.nights} onlyNights />
      </Section>
    );
  }

  return (
    <Section flush title="Membership health" icon={CardMembershipIcon}
      note="Due is somebody whose paid period ends inside the next thirty days. A tier nobody has ever paid for is neither due nor lapsed."
      action={(
        <DownloadButton variant="outlined" size="small"
          href={`/clubs/${slug}/manage/analytics/export/memberships`} />
      )}>
      <StatTiles columns={3} tiles={[
        { label: "Approved", value: String(data.health.total),
          note: "On the roster right now" },
        { label: "Due to renew", value: String(data.health.dueSoon),
          note: "Paid period ends within thirty days",
          emphasis: data.health.dueSoon > 0 },
        { label: "Lapsed", value: String(data.health.lapsed),
          note: "Paid period has already ended",
          emphasis: data.health.lapsed > 0 },
      ]} />
    </Section>
  );
}
