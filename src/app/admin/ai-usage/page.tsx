import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import EmptyState from "@/components/ui/EmptyState";
import { getAdminUsage } from "@/services/aiJobs.service";
import { monthYear } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "AI usage" };

/**
 * What every club has spent, by month.
 *
 * Failures are counted beside the runs and are not in the money, because a
 * club burning runs on a provider that keeps timing out is a thing to notice
 * and is not a thing to bill for. Six months, which is long enough to see a
 * club's shape and short enough to read.
 */
export default async function AdminAiUsagePage() {
  const rows = await getAdminUsage(6);
  const total = rows.reduce((sum, one) => sum + one.spendPence, 0);

  return (
    <Stack spacing={3}>
      <PageHead title="AI usage"
        lede={rows.length
          ? `${(total / 100).toFixed(2)} pounds across every club in the last six months.`
          : "Nothing has been run yet."} />

      {rows.length === 0 ? (
        <EmptyState title="No runs yet"
          description="A club has to turn the army builder on and sell one of the AI benefits before anything appears here." />
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
