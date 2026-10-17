import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { EventTeam } from "@/types/eventTeams";

/**
 * Where the teams finished, in the Results section.
 *
 * The client: "when setting placings for a team event, the results do not show
 * in their own results section on the front end, like we do with regular
 * events." They did not. A team event's result lives on
 * `club_event_teams.final_rank`, which the Teams section was drawing as part
 * of the standings, while Results only ever read `club_event_results` and so
 * showed the individual placings or nothing at all.
 *
 * The two sections answer different questions and both are worth having. Teams
 * is who entered and how it is going, read while the event runs. Results is
 * how it ended, which is what somebody opens the page for afterwards, and at a
 * team event the unit that ended is the team.
 *
 * Read-only on purpose: recording a place is done in the console beside the
 * draw, which is the same call `EventPlacings` already made.
 */
export default function TeamResults({ teams, faction }: {
  teams: EventTeam[];
  faction: Faction;
}) {
  // Only the placed ones, in the order the club gave out. A team the club has
  // not placed is still in the Teams section above; it is not a result.
  const placed = teams
    .filter((team) => team.finalRank !== null)
    .sort((a, b) => (a.finalRank ?? 0) - (b.finalRank ?? 0));

  if (!placed.length) return null;

  return (
    <Stack spacing={1.25}>
      {placed.map((team) => (
        <Box key={team.id}
          sx={{ display: "grid", gap: 1.5, alignItems: "baseline",
                gridTemplateColumns: "28px minmax(0, 1fr) auto",
                px: 2, py: 1.5, borderRadius: 1.5,
                border: `1px solid ${tokens.rule}`,
                backgroundColor: tokens.paper }}>
          <Typography sx={{ fontFamily: mono, fontSize: "1rem", fontWeight: 700,
                            color: faction.deep }}>
            {team.finalRank}
          </Typography>

          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: display, fontWeight: 700,
                              fontSize: "1rem" }}>
              {team.name}
            </Typography>
            {team.placement.trim() ? (
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {team.placement.toUpperCase()}
              </Typography>
            ) : null}
            {/* Who it was. A team's result belongs to the people in it, which
                is also where every one of their podium badges comes from. */}
            {team.players.length ? (
              <Typography variant="body2"
                sx={{ color: tokens.inkMuted, mt: 0.5 }}>
                {team.players.map((player) => player.name).join(" · ")}
              </Typography>
            ) : null}
          </Box>

          {team.finalScore !== null ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                              fontVariantNumeric: "tabular-nums",
                              whiteSpace: "nowrap" }}>
              {`${team.finalScore} PTS`}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}
