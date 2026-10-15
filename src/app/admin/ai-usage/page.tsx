import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import { aiDeployment, getAdminUsage } from "@/services/aiJobs.service";
import { AI_DEPLOYMENT_ADMIN } from "@/utils/ai-deployment";
import { AI_FEATURES } from "@/utils/ai-access";
import { monthYear } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

export const metadata = { title: "AI usage" };

/**
 * What every club has spent, by month.
 *
 * Failures are counted beside the runs and are not in the money, because a
 * club burning runs on a provider that keeps timing out is a thing to notice
 * and is not a thing to bill for. Six months, which is long enough to see a
 * club's shape and short enough to read.
 *
 * Whether it is switched on at all leads, because this is the one screen whose
 * reader can change that and the figures underneath mean something different
 * depending on the answer. Nought spent with it on is a quiet month; nought
 * spent with no account behind it is not a month at all. The page used to show
 * the second and explain it as the first, telling an admin that "a club has to
 * turn the army builder on" when the actual blocker was one environment
 * variable on their own deployment.
 */
export default async function AdminAiUsagePage() {
  const rows = await getAdminUsage(6);
  const total = rows.reduce((sum, one) => sum + one.spendPence, 0);

  // Asked per feature because `AI_FEATURES` can name a subset, and "on" here
  // means every one of the four. A page that said "on" while scouting was off
  // would be the kind of half-truth that costs a round trip.
  const states = AI_FEATURES.map((one) => aiDeployment(one));
  const state = states.every((one) => one === "on") ? "on"
    : states.some((one) => one === "no_key") ? "no_key" : "off";
  const live = state === "on";
  const said = AI_DEPLOYMENT_ADMIN[state];

  return (
    <Stack spacing={3}>
      <PageHead title="AI usage"
        lede={rows.length
          ? `${(total / 100).toFixed(2)} pounds across every club in the last six months.`
          : "Nothing has been run yet."} />

      {/* The catalogue's edition plate, in the same shape: the one fact every
          figure below depends on, stated before any of them. */}
      <Stack spacing={1.25}
        sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
              backgroundColor: tokens.paper }}>
        <Stack direction="row" spacing={1.5} useFlexGap
          sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1.05rem" }}>
            {said.headline}
          </Typography>
          <StatusChip label={live ? "On" : "Off"} tone={live ? "kept" : "waiting"} />
        </Stack>
        <Typography sx={{ fontSize: "0.9rem", color: tokens.inkMuted }}>
          {said.detail}
        </Typography>
      </Stack>

      {rows.length === 0 ? (
        <EmptyState title="No runs yet"
          description={live
            ? "A club has to turn the army builder on and sell one of the AI benefits before anything appears here."
            : "Nothing can run while it is off, so this stays empty whatever the clubs do."} />
      ) : (
        <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          sm: "repeat(2, minmax(0, 1fr))",
                                          lg: "repeat(3, minmax(0, 1fr))" } }}>
          {rows.map((row) => (
            <Stack key={`${row.clubId}-${row.month}`} spacing={1}
              sx={{ height: "100%", p: 2, borderRadius: 1.5,
                    border: `1px solid ${tokens.rule}`,
                    backgroundColor: tokens.paper }}>
              <Typography sx={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.3 }}>
                {row.clubName}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                color: tokens.inkMuted }}>
                {monthYear(row.month)}
              </Typography>

              <Stack direction="row" spacing={1}
                sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
                <Typography sx={{ fontFamily: mono, fontSize: "1.4rem", fontWeight: 700,
                                  lineHeight: 1, color: tokens.brass }}>
                  {`£${(row.spendPence / 100).toFixed(2)}`}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                  color: tokens.inkMuted }}>
                  {`${row.runs} run${row.runs === 1 ? "" : "s"}`}
                </Typography>
              </Stack>

              <Box sx={{ flex: 1 }} />

              <Typography sx={{ pt: 1, borderTop: `1px solid ${tokens.rule}`,
                                fontFamily: mono, fontSize: "0.66rem",
                                color: row.failures ? tokens.danger : tokens.inkMuted }}>
                {row.failures
                  ? `${row.failures} failed, charged nothing`
                  : "None failed"}
              </Typography>
            </Stack>
          ))}
        </Box>
      )}
    </Stack>
  );
}
