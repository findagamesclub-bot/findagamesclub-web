"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import PlayerName from "./PlayerName";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { SetupNote } from "./MatchDetailDialog";
import { armySummary } from "@/utils/army-snapshot";
import { fold } from "@/utils/text";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { EventPairing, ResultArmy } from "@/types/event";

type Match = EventPairing["matches"][number];

/**
 * One table of the draw: who is on it, what they brought, how it went.
 *
 * A side per line rather than "A v B" on one. The client asked to see the army,
 * the detachment and the disposition against each round result, and three
 * facts for two players is about ninety characters: on one line it wraps
 * mid-phrase, and 0164 already found that a "v" separator stops working the
 * moment the line it separates wraps. Given a line each, a player's army sits
 * under their own name and their score sits beside it, which is also how a
 * results sheet is actually written.
 *
 * The shape does not change when there are no armies. A round with nothing
 * recorded is still a side per line, because one round drawing two ways
 * depending on what somebody typed is worse than either.
 */
export default function PairingTable({
  match, faction, me, onOpenList, onOpenMatch,
}: {
  match: Match;
  faction: Faction;
  /** The reader's own folded name, so their row can say so. */
  me: string;
  onOpenList: (player: string, army: ResultArmy) => void;
  /** Opens the whole game: both armies and how it was set up. */
  onOpenMatch: () => void;
}) {
  const bye = !match.playerTwo.trim();
  const mine = Boolean(me)
    && (fold(match.playerOne) === me || fold(match.playerTwo) === me);

  const sides = [
    { name: match.playerOne, id: match.playerOneId,
      score: match.scoreOne, army: match.armyOne },
    { name: match.playerTwo, id: match.playerTwoId,
      score: match.scoreTwo, army: match.armyTwo },
  ].slice(0, bye ? 1 : 2);

  // Bold the better score. Both figures are on screen either way, so this is
  // emphasis on a fact a reader can already check, never the only thing
  // saying who won.
  //
  // A draw bolds neither. `Math.max` on two equal scores matches both, so the
  // first version made 41-41 read as both players winning.
  const drawn = match.scoreOne === match.scoreTwo;
  const best = bye || drawn || match.scoreOne === null || match.scoreTwo === null
    ? null
    : Math.max(match.scoreOne, match.scoreTwo);

  return (
    <Box
      sx={{ display: "grid", gap: { xs: 1, sm: 1.5 }, px: 2, py: 1.25,
            gridTemplateColumns: { xs: "44px minmax(0, 1fr)", sm: "72px minmax(0, 1fr)" },
            borderTop: `1px solid ${tokens.rule}`,
            backgroundColor: mine ? faction.soft : tokens.surface }}
    >
      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", pt: 0.25,
                        color: mine ? faction.deep : tokens.inkMuted }}>
        {(match.table ?? "").trim() || "—"}
      </Typography>

      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        {sides.map((side, i) => {
          const summary = armySummary(side.army);
          const isMe = Boolean(me) && fold(side.name) === me;

          return (
            <Stack key={i} spacing={0.1}
              sx={{ minWidth: 0,
                    // A hairline between the two players, so a table reads as
                    // one thing and two rounds of it do not run together.
                    pt: i === 0 ? 0 : 0.75,
                    borderTop: i === 0 ? "none" : `1px dashed ${tokens.rule}` }}>
              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                <PlayerName name={side.name} profileId={side.id} bold={isMe} />
                {side.score === null ? null : (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                                    fontVariantNumeric: "tabular-nums",
                                    fontWeight: side.score === best ? 700 : 400,
                                    color: mine ? faction.deep : tokens.ink,
                                    flexShrink: 0 }}>
                    {side.score}
                  </Typography>
                )}
              </Stack>

              {summary || side.army?.list ? (
                <Stack direction="row" spacing={0.75}
                  sx={{ alignItems: "baseline", flexWrap: "wrap", minWidth: 0 }}>
                  {/* Helper weight, not body: this is a note about the name
                      above it and has to sit under it rather than compete. */}
                  <Typography sx={{ fontSize: "0.75rem", lineHeight: 1.5,
                                    color: tokens.inkMuted, minWidth: 0 }}>
                    {summary || "Army not recorded"}
                  </Typography>
                  {side.army?.list ? (
                    <Button size="small" variant="text"
                      onClick={() => onOpenList(side.name, side.army!)}
                      startIcon={<FormatListBulletedIcon sx={{ fontSize: 14 }} />}
                      sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: "0.72rem",
                            color: faction.deep }}>
                      List
                    </Button>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          );
        })}

        {/* How the game was set up, and the way into the whole of it. The
            setup belongs to the table rather than to a player, so it sits
            under both of them, and the control beside it opens the match
            rather than one side's list: "click an event round game and see
            then those details of that match" is what it answers. */}
        {match.setup || match.armyOne || match.armyTwo ? (
          <Stack direction="row" spacing={1} useFlexGap
            sx={{ alignItems: "baseline", flexWrap: "wrap", pt: 0.5 }}>
            <SetupNote setup={match.setup} />
            <Button size="small" variant="text" onClick={onOpenMatch}
              startIcon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />}
              sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: "0.72rem",
                    color: faction.deep }}>
              The game
            </Button>
          </Stack>
        ) : null}

        {bye ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                            letterSpacing: "0.08em",
                            color: mine ? faction.deep : tokens.inkMuted }}>
            BYE
          </Typography>
        ) : null}

        {/* Named, not only tinted: a coloured row says nothing to a reader who
            cannot see the tint. */}
        {mine ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: faction.deep }}>
            YOUR TABLE
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
