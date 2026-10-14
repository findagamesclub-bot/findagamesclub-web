"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PlaceDialog from "../teams/PlaceDialog";
import { teamsAction, type TeamsState } from "../teams/actions";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { EventTeam } from "@/types/eventTeams";

/**
 * Where each team finished, which is how a team event finishes.
 *
 * The client's words: "placings for team events is incorrect, it asks for
 * player names whereas it should ask for the team name and overall team
 * score." This page asked for a player because it is the same page an
 * ordinary event uses, and an ordinary event is placed one player at a time.
 *
 * A team event is not. The unit is the team, the players inside it come with
 * it, and the badge every one of them gets is already awarded off this rank
 * (0167). So the page asks the question the format asks.
 *
 * The dialog is the Teams page's own, so the two screens cannot drift about
 * what placing a team means or what it does to the badges.
 */
export default function TeamPlacings({
  slug, eventId, teams, faction,
}: {
  slug: string;
  eventId: number;
  teams: EventTeam[];
  faction: Faction;
}) {
  const [state, submit, busy] = useActionState<TeamsState, FormData>(teamsAction, {});
  useActionToast(state);

  const [placing, setPlacing] = useState<EventTeam | null>(null);
  useActionSuccess(state, () => setPlacing(null));

  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("eventId", String(eventId));
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    startTransition(() => submit(data));
  };

  if (!teams.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        No teams have entered yet, so there is nothing to place. Build them on
        the Teams page first.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {teams.map((team, index) => {
        const placed = team.finalRank !== null;

        return (
          <Box key={team.id}
            sx={{ display: "grid", gap: { xs: 1, sm: 2 }, alignItems: "center",
                  gridTemplateColumns: { xs: "48px minmax(0, 1fr)",
                                         sm: "64px minmax(0, 1fr) auto" },
                  px: 2, py: 1.75, borderRadius: 2,
                  border: `1px solid ${placed ? faction.base : tokens.rule}`,
                  backgroundColor: placed ? faction.soft : tokens.paper }}>
            <Stack spacing={0} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontFamily: mono, fontSize: "1.3rem", fontWeight: 700,
                                color: placed ? faction.deep : tokens.inkMuted }}>
                {team.finalRank ?? "—"}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.58rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                PLACE
              </Typography>
            </Stack>

            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} useFlexGap
                sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 700 }}>{team.name}</Typography>
                {team.placement ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                    letterSpacing: "0.08em", color: faction.deep }}>
                    {team.placement.toUpperCase()}
                  </Typography>
                ) : null}
                {team.finalScore !== null ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                                    fontWeight: 700, color: tokens.brass }}>
                    {`${team.finalScore} PTS`}
                  </Typography>
                ) : null}
              </Stack>

              {/* The players come with the team, because the client asked for
                  the placings to show each player in it and because they are
                  who the badge actually reaches. */}
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {team.players.length
                  ? team.players.map((player) => player.name).join(" · ")
                  : "Nobody in this team yet."}
              </Typography>
            </Stack>

            <Button size="small" variant={placed ? "text" : "outlined"}
              disabled={busy} onClick={() => setPlacing(team)}
              sx={{ gridColumn: { xs: "1 / -1", sm: "auto" },
                    justifySelf: { xs: "flex-start", sm: "auto" } }}>
              {placed ? "Change the place" : "Set the place"}
            </Button>

            {/* Keeps the grid honest when a team has never been placed. */}
            <Box sx={{ display: "none" }} aria-hidden>{index}</Box>
          </Box>
        );
      })}

      <PlaceDialog team={placing} saving={busy}
        onClose={() => setPlacing(null)}
        onSave={(fields) => send(fields)} />
    </Stack>
  );
}
