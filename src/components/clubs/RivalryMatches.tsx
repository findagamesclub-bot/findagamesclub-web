"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Pager from "@/components/ui/Pager";
import { useMatchDetail, MatchDetailButton }
  from "@/components/results/MatchDetailControl";
import { armyOf, gameWasRecorded, setupOf, sideOf, NO_GAME_DETAILS,
  type GameDetails } from "@/utils/game-details";
import { usePagedList } from "@/hooks/usePagedList";
import { shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
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
  matches, oneName, twoName, iAmOne, iAmTwo, oneId = null,
  faction, played = NO_GAME_DETAILS,
}: {
  matches: RivalryMatch[];
  oneName: string;
  twoName: string;
  iAmOne: boolean;
  iAmTwo: boolean;
  /** Whose side every figure here is written from, so the armies follow it. */
  oneId?: string | null;
  faction: Faction;
  /** The army, the list and the setup behind each game, where there is one. */
  played?: GameDetails;
}) {
  const detail = useMatchDetail(faction);
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
          // Every figure on this page is written from the first member's side,
          // so the armies have to be read the same way round.
          const ref = { source: m.source, id: m.bookingId };
          // Not `first`, which this file already uses for a first name.
          const oneIs = sideOf(played, ref, { id: oneId, name: oneName });

          return (
            <Box key={`${m.source}-${m.bookingId}`}
              sx={{ display: "grid", gap: { xs: 0.5, sm: 1.5 }, px: 2, py: 1.5,
                    alignItems: { sm: "baseline" },
                    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "76px minmax(0, 1fr) 104px 138px" },
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
                {gameWasRecorded(played, ref) ? (
                  <Box sx={{ mt: 0.5 }}>
                    <MatchDetailButton faction={faction} setup={setupOf(played, ref)}
                      onOpen={() => detail.open({
                        label: `${oneName} v ${twoName}`,
                        playerOne: oneName, playerTwo: twoName,
                        scoreOne: String(m.scoreOne), scoreTwo: String(m.scoreTwo),
                        armyOne: armyOf(played, ref, oneIs),
                        armyTwo: armyOf(played, ref, oneIs === "one" ? "two" : "one"),
                        setup: setupOf(played, ref),
                      })} />
                  </Box>
                ) : null}
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

      {/* One pair of dialogs for the list. A pair who have met weekly for five
          years have a few hundred of these rows. */}
      {detail.dialogs}
    </Stack>
  );
}
