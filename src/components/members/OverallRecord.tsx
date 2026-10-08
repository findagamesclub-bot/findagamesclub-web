import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { display, mono, tokens } from "@/lib/tokens";
import { winRate } from "@/utils/meta-signal";
import { recordLine, SOURCE_LABELS, SOURCE_NOTES } from "@/utils/overall-record";
import type { OverallRecord as Record } from "@/services/memberOverall.service";

/**
 * Everything they have played, added up and then broken apart again.
 *
 * The headline is the record a wargamer writes down, so it is the one large
 * figure on the panel. It is set in ink rather than in green or red: the
 * grudge tracker colours a head to head because a rivalry has a leader, and
 * somebody's whole playing history does not. The win rate takes the brass,
 * which is the one thing on the card a reader scans for.
 */
export default function OverallRecord({ record, name }: {
  record: Record;
  /** First name, for the sentence under the figures. */
  name: string;
}) {
  const { total, sources, rate } = record;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2}
        sx={{ px: 2.25, py: 2, borderRadius: 2, alignItems: "center",
              border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            WON, DRAWN, LOST
          </Typography>
          {/* No line naming the three underneath it: the three cards below
              are labelled CLUB NIGHTS, EVENT GAMES and LEAGUES AND
              COMPETITIONS, so a caption listing them was the same fact twice
              and it was what pushed this card to three lines at 360. */}
          <Typography sx={{ fontFamily: display, fontWeight: 600 }}>
            {`${total.played} ${total.played === 1 ? "game" : "games"} on record for ${name}.`}
          </Typography>
        </Box>

        <Stack sx={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "1.6rem", fontWeight: 700,
                            lineHeight: 1.1, color: tokens.ink }}>
            {recordLine(total)}
          </Typography>
          {rate === null ? null : (
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                              letterSpacing: "0.06em", color: tokens.brass }}>
              {`${rate.toFixed(1)}% WON`}
            </Typography>
          )}
        </Stack>
      </Stack>

      {/* Three across, because the three are peers and a column of three
          full-width bands is a scroll for nine numbers. */}
      <Box sx={{ display: "grid", gap: 1.25,
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" } }}>
        {sources.map((row) => {
          const played = row.played > 0;
          const rowRate = winRate(row.played, row.wins);

          return (
            <Stack key={row.source} spacing={0.5}
              sx={{ px: 1.75, py: 1.5, borderRadius: 2, height: "100%",
                    border: `1px solid ${tokens.rule}`,
                    backgroundColor: played ? tokens.paper : "transparent" }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {SOURCE_LABELS[row.source].toUpperCase()}
              </Typography>

              {played ? (
                <>
                  <Typography sx={{ fontFamily: mono, fontSize: "1.1rem",
                                    fontWeight: 700, lineHeight: 1.2 }}>
                    {recordLine(row)}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                    color: tokens.inkMuted }}>
                    {`${row.played} ${row.played === 1 ? "GAME" : "GAMES"}`}
                    {rowRate === null ? "" : ` · ${rowRate.toFixed(1)}%`}
                  </Typography>
                </>
              ) : (
                // One muted line, never a nought set as large as a real
                // record: "none yet" is the honest reading and a 0-0-0 reads
                // as a run of defeats.
                <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                  Nothing recorded yet.
                </Typography>
              )}

              <Typography variant="caption"
                sx={{ color: tokens.inkMuted, mt: "auto", pt: 0.5 }}>
                {SOURCE_NOTES[row.source]}
              </Typography>
            </Stack>
          );
        })}
      </Box>
    </Stack>
  );
}
