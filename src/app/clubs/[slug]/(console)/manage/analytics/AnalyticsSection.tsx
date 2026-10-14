import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import PaymentsIcon from "@mui/icons-material/Payments";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import TimelineIcon from "@mui/icons-material/Timeline";
import StorefrontIcon from "@mui/icons-material/Storefront";
import Section from "@/components/ui/Section";
import StatTiles from "@/components/ui/StatTiles";
import DownloadButton from "@/components/ui/DownloadButton";
import EmptyState from "@/components/ui/EmptyState";
import MonoLabel from "@/components/ui/MonoLabel";
import RankedBars from "@/components/ui/RankedBars";
import AnalyticsCharts from "./AnalyticsCharts";
import PeopleLists from "./PeopleLists";
import type { ClubAnalytics } from "@/services/analytics.service";
import type { AnalyticsTabKey } from "@/utils/analytics-tabs";
import type { PeriodKey } from "@/utils/analytics-period";
import { periodLabel } from "@/utils/analytics-period";
import { totalMoney } from "@/services/analytics.service";
import { formatPounds } from "@/utils/format";
import type { LadderRung } from "@/utils/loyalty-spread";
import { display, tokens } from "@/lib/tokens";

/** Whichever section the open tab asked for. One of six, never two. */
export default function AnalyticsSection({
  tab, data, slug, period, ladder = [],
}: {
  tab: AnalyticsTabKey;
  data: ClubAnalytics;
  slug: string;
  period: PeriodKey;
  /** The club's loyalty rungs with the roster counted onto them. */
  ladder?: LadderRung[];
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
              ["Merchandise", data.money.shop],
              // 0157 priced coaching and this list was never told, so a club
              // selling it read a revenue figure short by all of it.
              ["Coaching", data.money.coaching],
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
        note="Each month of the window you picked, split by where the money came from. Empty months are shown as zero rather than skipped, so a quiet August reads as quiet rather than missing.">
        {/* No picker of its own any more. It had one, so this tab carried the
            page's window and its own, and a club comparing the chart to the
            Money tab was comparing two different spans of time without being
            told. */}
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

  if (tab === "sales") {
    const { items, sessions } = data.sales;
    return (
      <Section flush title="Shop and coaching" icon={StorefrontIcon}
        note="What sold and what filled up, inside the window you picked. Ranked by how many went rather than by what they brought in: the most popular thing and the most valuable one are often not the same, so both figures are on the row.">
        {!items.length && !sessions.length ? (
          <EmptyState title="Nothing sold in this window"
            description="An order or a coaching place inside the window puts a ranking here. Try a wider one if the club has been going longer than this." />
        ) : (
          <Box sx={{ display: "grid", gap: 3,
                     gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                            lg: "repeat(2, minmax(0, 1fr))" } }}>
            <Box>
              <MonoLabel>{`MERCHANDISE · ${data.sales.itemsSold} SOLD`}</MonoLabel>
              {items.length ? (
                <RankedBars
                  rows={items.map((i) => ({
                    label: i.label, value: i.sold,
                    note: pounds(Number(i.revenue ?? 0)),
                  }))}
                  suffix={() => "sold"} />
              ) : (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  Nothing sold from the shop in this window.
                </Typography>
              )}
            </Box>

            <Box>
              <MonoLabel>{`COACHING · ${data.sales.placesTaken} PLACES`}</MonoLabel>
              {sessions.length ? (
                <RankedBars
                  rows={sessions.map((s) => ({
                    label: s.label, value: s.booked,
                    note: pounds(Number(s.revenue ?? 0)),
                  }))}
                  suffix={(n: number) => (n === 1 ? "place" : "places")} />
              ) : (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  No coaching ran in this window.
                </Typography>
              )}
            </Box>
          </Box>
        )}
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
      <StatTiles columns={4} tiles={[
        { label: "Approved", value: String(data.health.total),
          note: "On the roster right now" },
        // Not the period's own label: "All time" lowercased reads "In the all
        // time you picked", and the window is named on the picker directly
        // above this anyway.
        { label: "Joined", value: String(data.health.joined),
          note: "Inside the window you picked" },
        { label: "Due to renew", value: String(data.health.dueSoon),
          note: "Paid period ends within thirty days",
          emphasis: data.health.dueSoon > 0 },
        { label: "Lapsed", value: String(data.health.lapsed),
          note: "Paid period has already ended",
          emphasis: data.health.lapsed > 0 },
      ]} />

      {/* The tier split has been in this read since 0117 and only the
          spreadsheet ever showed it, so a club could download the answer and
          not see it on the screen it downloaded it from.

          Two columns because they are two different questions. A membership
          tier is what somebody pays for and a loyalty rung is what they have
          earned, and a club acts on them separately: one is a renewal
          conversation, the other is who to thank. */}
      {data.health.total ? (
        <Box sx={{ display: "grid", gap: 3, mt: 3.5,
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          lg: "repeat(2, minmax(0, 1fr))" } }}>
          <Box>
            <MonoLabel>MEMBERSHIP TIERS</MonoLabel>
            <RankedBars
              rows={data.health.byTier.map((row) => ({
                label: row.label, value: row.members,
                // How many of them arrived inside the window. The count
                // itself cannot follow the window, because every window on
                // this page ends today and the answer would be the same five
                // times over. This is the half that moves.
                note: row.joined
                  ? `${row.joined} joined`
                  : undefined,
              }))}
              suffix={(n: number) => (n === 1 ? "member" : "members")} />
          </Box>

          <Box>
            <MonoLabel>LOYALTY TIERS</MonoLabel>
            <RankedBars
              emphasiseLeader={false}
              rows={ladder.map((rung) => ({
                label: rung.label, value: rung.members,
              }))}
              suffix={(n: number) => (n === 1 ? "member" : "members")} />
            <Typography sx={{ fontFamily: display, fontSize: "0.75rem",
                              lineHeight: 1.6, color: tokens.inkMuted, mt: 1.25 }}>
              Your own ladder, by lifetime points. A member who has never
              earned one is on the bottom rung rather than missing.
            </Typography>
          </Box>
        </Box>
      ) : null}
    </Section>
  );
}
