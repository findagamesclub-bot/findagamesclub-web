"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { display, mono, tokens } from "@/lib/tokens";
import type { EventTeam } from "@/types/eventTeams";
import type { TeamStanding } from "@/utils/team-standings";

/**
 * One team, with its players in the order they play.
 *
 * The playing order is the point of the list, so it carries the mono treatment
 * figures get everywhere else here and the name reads as the thing beside it.
 * A player with no account is shown exactly the same, because at the door that
 * is most of them and dimming them would read as something being wrong.
 */
export default function TeamCard({
  team, standing, busy, onEdit, onPlace, onRemove,
}: {
  team: EventTeam;
  /** How they are doing, or null before any round has been scored. */
  standing: TeamStanding | null;
  busy: boolean;
  onEdit: () => void;
  onPlace: () => void;
  onRemove: () => void;
}) {
  const played = standing && standing.played > 0;

  return (
    <Stack spacing={1.25}
      sx={{ p: 2, borderRadius: 2, height: "100%",
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <Typography sx={{ fontFamily: display, fontSize: "1.05rem", fontWeight: 700,
                          flex: 1, minWidth: 0 }}>
          {team.name}
        </Typography>

        {/* Where the club has placed them. Brass because it is the one fact on
            the card somebody scans a grid for. */}
        {team.finalRank ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.brass,
                            border: `1px solid ${tokens.brass}`, borderRadius: 0.75,
                            px: 0.75, py: 0.25, flexShrink: 0 }}>
            {(team.placement || `${team.finalRank}`).toUpperCase()}
          </Typography>
        ) : null}
      </Stack>

      <Stack spacing={0.4}>
        {team.players.map((player, index) => (
          <Stack key={player.id} direction="row" spacing={1}
            sx={{ alignItems: "baseline" }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                              color: tokens.inkMuted, width: 18, flexShrink: 0 }}>
              {index + 1}
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", minWidth: 0 }} noWrap>
              {player.name}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Box sx={{ flex: 1 }} />

      <Stack spacing={1.25} sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
        {/* Said in words before any round has been scored, because a row of
            noughts reads as a team that has lost everything. */}
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted }}>
          {played
            ? `${standing!.won}-${standing!.drawn}-${standing!.lost} · `
              + `${standing!.points} PTS · ${standing!.tablesWon} `
              + `${standing!.tablesWon === 1 ? "TABLE" : "TABLES"} WON`
            : `${team.players.length} ${team.players.length === 1 ? "PLAYER" : "PLAYERS"} · NOT PLAYED YET`}
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button size="small" variant="outlined" disabled={busy} onClick={onEdit}>
            Edit
          </Button>
          <Button size="small" variant="outlined" disabled={busy} onClick={onPlace}>
            {team.finalRank ? "Change place" : "Place them"}
          </Button>
          <Button size="small" disabled={busy} onClick={onRemove}
            sx={{ color: tokens.danger }}>
            Remove
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
