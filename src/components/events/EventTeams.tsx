"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import { teamStandings } from "@/utils/team-standings";
import type { EventTeam, TeamFixture } from "@/types/eventTeams";

/**
 * The teams at a team event, and how they are doing.
 *
 * One row per team rather than a grid of cards, because this is a table and a
 * table is read down a column: the whole question is who is above whom. The
 * boards fold away under each row, since "who is in Red Dice" is the second
 * question and asking it of twelve teams at once is a page of names.
 *
 * The place the club has given a team wins over the running order, and the
 * column headings say which is which, so nobody reads a mid-tournament table
 * as the result.
 */
export default function EventTeams({ teams, fixtures, faction, viewerName }: {
  teams: EventTeam[];
  fixtures: TeamFixture[];
  faction: Faction;
  /** So somebody reading finds their own team without counting. */
  viewerName: string | null;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const standings = useMemo(() => teamStandings(teams, fixtures), [teams, fixtures]);
  const placed = teams.some((team) => team.finalRank !== null);
  const played = standings.some((row) => row.played > 0);

  const mine = (team: EventTeam) =>
    Boolean(viewerName) && team.players.some(
      (player) => player.name.trim().toLowerCase() === viewerName!.trim().toLowerCase());

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        {placed
          // Not "what the tables added up to" any more. Since 0176 a club can
          // score a fixture itself, so the figure in this column is whichever
          // of the two the club runs on, and naming only one of them is the
          // stale-copy fault that keeps turning up.
          ? "The club has given out the places. Points are what each round was scored at."
          : played
            ? "How it stands so far. The club gives out the places at the end, so this is the running order and not the result."
            : "Nobody has played yet, so this is just who entered."}
      </Typography>

      <Box sx={{ borderRadius: 2, overflow: "hidden",
                 border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        {standings.map((row, index) => {
          const team = teams.find((t) => t.id === row.teamId)!;
          const showing = open === team.id;

          return (
            <Box key={team.id}
              sx={{ borderTop: index === 0 ? "none" : `1px solid ${tokens.rule}`,
                    // The reader's own team, in their club's colour. The same
                    // way the individual draw marks the table they are on.
                    backgroundColor: mine(team) ? faction.soft : "transparent" }}>
              <Stack direction="row" spacing={1.5}
                sx={{ px: 2, py: 1.5, alignItems: "center" }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", fontWeight: 700,
                                  color: tokens.inkMuted, width: 26, flexShrink: 0 }}>
                  {team.finalRank ?? index + 1}
                </Typography>

                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontFamily: display, fontSize: "0.98rem",
                                    fontWeight: 700 }} noWrap>
                    {team.name}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                    letterSpacing: "0.07em", color: tokens.inkMuted }}>
                    {[
                      team.placement ? team.placement.toUpperCase() : null,
                      // The club's own figure for where they finished, in
                      // whatever the format counts. Only once it has said.
                      team.finalScore !== null ? `${team.finalScore} PTS` : null,
                      row.played ? `${row.won}-${row.drawn}-${row.lost}` : null,
                      // Said in words, because a bare "1 TABLE" in a column
                      // with no heading reads as the table they are playing
                      // on, and both teams in a two-board fixture show one.
                      row.played
                        ? `${row.tablesWon} ${row.tablesWon === 1 ? "TABLE" : "TABLES"} WON`
                        : `${team.players.length} ${team.players.length === 1 ? "BOARD" : "BOARDS"}`,
                    ].filter(Boolean).join(" · ")}
                  </Typography>
                </Stack>

                {/* Points, which is what the order is built on and the one
                    figure a reader scans a league table for. */}
                {row.played ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "1rem", fontWeight: 700,
                                    flexShrink: 0 }}>
                    {row.points}
                    <Box component="span" sx={{ fontSize: "0.62rem", fontWeight: 700,
                                                color: tokens.inkMuted, ml: 0.5 }}>
                      PTS
                    </Box>
                  </Typography>
                ) : null}

                <IconButton size="small" aria-label={`Who plays for ${team.name}`}
                  onClick={() => setOpen(showing ? null : team.id)}
                  sx={{ flexShrink: 0, color: tokens.inkMuted }}>
                  {/* Two states, two icons. */}
                  {showing ? <ExpandLessIcon fontSize="small" />
                           : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              </Stack>

              <Collapse in={showing} unmountOnExit>
                <Stack spacing={0.4} sx={{ px: 2, pb: 1.75, pl: 5.5 }}>
                  {team.players.map((player, board) => (
                    <Stack key={player.id} direction="row" spacing={1}
                      sx={{ alignItems: "baseline" }}>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.65rem",
                                        fontWeight: 700, color: tokens.inkMuted,
                                        width: 18, flexShrink: 0 }}>
                        {board + 1}
                      </Typography>
                      <Typography sx={{ fontSize: "0.88rem", minWidth: 0 }}>
                        {player.name}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
