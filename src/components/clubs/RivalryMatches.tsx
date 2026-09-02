"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { RivalryMatch } from "@/services/games.service";
import MonoLabel from "@/components/ui/MonoLabel";
import { PER_PAGE } from "@/utils/paging";

/** A pair who have met weekly for five years have a few hundred of these. */
const PAGE = PER_PAGE.rows;

/**
 * Every game the two of them have played, newest first.
 *
 * Named results rather than coloured ones: green and red mean "you", so they
 * only apply when the reader is one of the pair, and a reader watching
 * somebody else's rivalry gets neutral text instead of a colour that means
 * nothing to them.
 */
export default function RivalryMatches({
  matches, oneName, twoName, iAmOne, iAmTwo,
}: {
  matches: RivalryMatch[];
  oneName: string;
  twoName: string;
  iAmOne: boolean;
  iAmTwo: boolean;
}) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(matches, PAGE, top);
  const mine = iAmOne || iAmTwo;
  const first = (name: string) => name.split(" ")[0]!.toUpperCase();

  return (
    <Stack spacing={2}>
      <MonoLabel>EVERY GAME, NEWEST FIRST</MonoLabel>

      <Box ref={top}
        sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
        {paged.shown.map((m, i) => {
          const margin = Math.abs(m.scoreOne - m.scoreTwo);
          const oneWon = m.outcome === "won";
          const drew = m.outcome === "drew";

          return (
            <Box key={`${m.source}-${m.bookingId}`}
              sx={{ display: "grid", gap: { xs: 0.5, sm: 1.5 }, px: 2, py: 1.5,
                    alignItems: { sm: "baseline" },
                    gridTemplateColumns: { xs: "1fr", sm: "76px minmax(0, 1fr) 104px 138px" },
                    borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                    backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
                {(shortDate(m.date) ?? "NO DATE").toUpperCase()}
              </Typography>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{m.game}</Typography>
                {/* Where the game came from. Now that a league round counts
                    towards the record, a reader is owed the answer to "when did
                    we play that?" without opening the competition. */}
                <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.06em",
                                  color: tokens.inkMuted, mt: 0.25 }}>
                  {m.source === "competition"
                    ? m.competition.toUpperCase()
                    : "TABLE BOOKING"}
                </Typography>
              </Box>

              {/* The winning number carries the weight, so the result is
                  legible before anybody reads the label beside it. */}
              <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums",
                                fontSize: "0.95rem", textAlign: { sm: "right" } }}>
                <Box component="span"
                  sx={{ fontWeight: drew || oneWon ? 700 : 400,
                        color: drew || oneWon ? tokens.ink : tokens.inkMuted }}>
                  {m.scoreOne}
                </Box>
                <Box component="span" sx={{ color: tokens.inkMuted, mx: 0.75 }}>–</Box>
                <Box component="span"
                  sx={{ fontWeight: drew || !oneWon ? 700 : 400,
                        color: drew || !oneWon ? tokens.ink : tokens.inkMuted }}>
                  {m.scoreTwo}
                </Box>
              </Typography>

              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", lineHeight: 1.35,
                                textAlign: { sm: "right" },
                                color: drew || !mine
                                  ? tokens.inkMuted
                                  : oneWon === iAmOne ? tokens.positive : tokens.danger }}>
                {drew ? "DRAW" : `${first(oneWon ? oneName : twoName)} WON BY ${margin}`}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Pager page={paged.page} total={paged.total} noun="games" size={PAGE}
        onChange={paged.goTo} />
    </Stack>
  );
}
