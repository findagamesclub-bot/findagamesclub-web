import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import RankedBars from "@/components/ui/RankedBars";
import type { AnalyticsPeople, Named } from "@/repositories/analytics.repository";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * Three lists that answer three different questions.
 *
 * Not three equal columns, which is how this shipped and why it read as
 * congested: one of them holds the answer and the other two are usually empty,
 * so three equal widths gave two thirds of the space to the word "none" and
 * rendered it as a dashed box the size of a card. They are not peers either.
 * "Turning up most" is a ranking you read; the other two are lists of people
 * you contact, which makes them one job, not two.
 *
 * So: the ranking gets the width and a bar per row, because two numbers side by
 * side is a comparison somebody has to do and a bar is one they can see. The
 * two chase lists stack beside it and shrink to a single line when there is
 * nobody on them, which is the common case and should look like good news
 * rather than a hole in the page.
 */
export default function PeopleLists({ people }: { people: AnalyticsPeople }) {
  return (
    <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
               gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                      md: "minmax(0, 1.45fr) minmax(0, 1fr)" } }}>
      <Ranking rows={people.mostActive} />

      <Stack spacing={2.5}>
        <ChaseList
          title="Dropped off" count={people.droppedOffCount} rows={people.droppedOff}
          empty="Nobody has gone quiet. Everybody busy last time is still busy."
          unit="before, none since"
        />
        <ChaseList
          title="Not seen at all" count={people.dormantCount} rows={people.dormant}
          empty="Everybody on the roster did something."
          unit=""
        />
      </Stack>
    </Box>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="h3" sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                     letterSpacing: "0.1em", color: tokens.inkMuted }}>
      {children}
    </Typography>
  );
}

/** Who is carrying the club, in order, with the gap between them visible. */
function Ranking({ rows }: { rows: Named[] }) {
  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5,
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Heading>Turning up most</Heading>

      {rows.length === 0 ? (
        <Typography sx={{ mt: 1.5, fontSize: "0.92rem", color: tokens.inkMuted }}>
          Nobody has booked, bought or posted in this window. Try a wider one.
        </Typography>
      ) : (
        <Box sx={{ mt: 2 }}>
          <RankedBars monograms
            rows={rows.map((r) => ({ label: r.name, value: r.value }))}
            suffix={(v) => (v === 1 ? "thing done" : "things done")} />
        </Box>
      )}
    </Box>
  );
}

/** People worth a message. Quiet when there is nobody, because that is good. */
function ChaseList({
  title, count, rows, empty, unit,
}: {
  title: string; count: number; rows: Named[]; empty: string; unit: string;
}) {
  const none = rows.length === 0;

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5,
               border: `1px solid ${none ? tokens.rule : tokens.brass}`,
               backgroundColor: tokens.paper }}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Heading>{title}</Heading>
        {/* A figure only when there is one. The house rule is never a bare 0,
            and a zero here is said in words underneath instead. */}
        {count > 0 ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700,
                            color: tokens.brass, lineHeight: 1 }}>
            {count}
          </Typography>
        ) : null}
      </Stack>

      {none ? (
        // Smaller than the data beside it. At the body size this read as the
        // loudest thing on the page, which is backwards: "nobody" is the
        // answer you glance at, not the one you study.
        <Typography sx={{ mt: 1, fontSize: "0.92rem", lineHeight: 1.5,
                          color: tokens.inkMuted }}>
          {empty}
        </Typography>
      ) : (
        <Stack spacing={0} sx={{ mt: 1 }}>
          {rows.map((row) => (
            <Stack key={row.name} direction="row" spacing={2}
              sx={{ justifyContent: "space-between", alignItems: "baseline", py: 0.9,
                    borderBottom: `1px solid ${tokens.rule}`,
                    "&:last-of-type": { borderBottom: 0 } }}>
              <Typography sx={{ fontFamily: display, fontWeight: 600, fontSize: "0.95rem",
                                minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap" }}>
                {row.name}
              </Typography>
              {row.value > 0 && unit ? (
                <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                  color: tokens.inkMuted, flexShrink: 0 }}>
                  {row.value} {unit}
                </Typography>
              ) : null}
            </Stack>
          ))}
          {count > rows.length ? (
            <Typography sx={{ mt: 1.25, fontSize: "0.92rem", color: tokens.inkMuted }}>
              And {count - rows.length} more.
            </Typography>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}
