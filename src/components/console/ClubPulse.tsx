import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MonthBarChart from "@/components/ui/MonthBarChart";
import DonutChart from "@/components/ui/DonutChart";
import EmptyState from "@/components/ui/EmptyState";
import { mono, tokens } from "@/lib/tokens";
import type { ClubPulse as Pulse } from "@/services/clubPulse.service";

/**
 * The club's year, in the same three layers the member dashboard uses.
 *
 * A chart for the run, then two breakdowns for the make-up. The glance is the
 * section cards above, which already carry the members and the tables; a tile
 * repeating either of them here would be the same figure twice on one screen.
 */
export default function ClubPulse({
  pulse, colour,
}: {
  pulse: Pulse;
  /** The club's faction colour. It identifies the club, it does not decorate. */
  colour: string;
}) {
  if (!pulse.hasHistory) {
    return (
      <EmptyState
        title="Nothing to chart yet"
        description="Once members join and tables get booked, this fills in with the club's year."
      />
    );
  }

  const busiest = pulse.nights[0];
  const labels = pulse.months.map((m) => m.label);

  return (
    <Stack spacing={2.5}>
      <Panel title="The year">
        <MonthBarChart
          labels={labels}
          series={[
            { name: "Tables booked", color: colour,
              values: pulse.months.map((m) => m.tables) },
            { name: "Members joined", color: tokens.brass,
              values: pulse.months.map((m) => m.joined) },
          ]}
        />
      </Panel>

      <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)",
                   md: "repeat(2, minmax(0, 1fr))",
                 } }}>
        <Panel title="Who is on which tier">
          <DonutChart
            centreValue={String(pulse.members.total)}
            centreLabel={pulse.members.total === 1 ? "member" : "members"}
            slices={pulse.tiers.map((t, i) => ({
              key: t.key || "none", label: t.label, value: t.value,
              color: TIER_COLOURS[i % TIER_COLOURS.length]!,
            }))}
          />
        </Panel>

        <Panel title="Which nights they play">
          <Stack spacing={1}>
            {pulse.nights.map((night) => (
              <Stack key={night.label} direction="row" spacing={1.5}
                sx={{ alignItems: "center" }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", width: 34,
                                  letterSpacing: "0.08em", color: tokens.inkMuted }}>
                  {night.short.toUpperCase()}
                </Typography>
                <Box sx={{ flex: 1, height: 8, borderRadius: 4,
                           backgroundColor: tokens.surface,
                           border: `1px solid ${tokens.rule}`, overflow: "hidden" }}>
                  <Box sx={{ height: "100%", backgroundColor: colour,
                             width: `${Math.round((night.value / (busiest?.value || 1)) * 100)}%` }} />
                </Box>
                <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", fontWeight: 700,
                                  fontVariantNumeric: "tabular-nums", minWidth: 24,
                                  textAlign: "right" }}>
                  {night.value}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Panel>
      </Box>
    </Stack>
  );
}

/** Enough tones for a club that has invented six tiers, in ladder order. */
const TIER_COLOURS = ["#8C5A2B", "#7A8794", "#B8862B", "#5C7C8A", "#6B2D5C", "#1E6B72"];


function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 2, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
               backgroundColor: tokens.paper }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                        letterSpacing: "0.12em", color: tokens.inkMuted, mb: 1.5 }}>
        {title.toUpperCase()}
      </Typography>
      {children}
    </Box>
  );
}
