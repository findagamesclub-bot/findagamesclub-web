"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import BusyOverlay from "@/components/ui/BusyOverlay";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import LinkButton from "@/components/ui/LinkButton";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { useActionToast } from "@/components/ui/Toaster";
import TeamCard from "./TeamCard";
import TeamDialog from "./TeamDialog";
import PlaceDialog from "./PlaceDialog";
import { teamsAction, type TeamsState } from "./actions";
import { teamStandings } from "@/utils/team-standings";
import { mono, tokens } from "@/lib/tokens";
import type { EventTeam, TeamFixture } from "@/types/eventTeams";
import type { Player } from "@/utils/pairings-draw";

/**
 * The teams at an event, set up once and then drawn every round.
 *
 * The switch is at the top because nothing under it means anything until it is
 * on, and it is the only place it appears: a second copy in the event editor
 * would be two controls for one fact, and the first one somebody found would
 * be the one that looked broken.
 */
export default function TeamBoard({
  slug, eventId, teamEvent, teams, fixtures, roster,
}: {
  slug: string;
  eventId: number;
  teamEvent: boolean;
  teams: EventTeam[];
  /** Every fixture on the event, for the running table. */
  fixtures: TeamFixture[];
  roster: Player[];
}) {
  const [state, submit, busy] = useActionState<TeamsState, FormData>(teamsAction, {});
  useActionToast(state);

  const [editing, setEditing] = useState<EventTeam | null | undefined>(undefined);
  const [placing, setPlacing] = useState<EventTeam | null>(null);
  const [removing, setRemoving] = useState<EventTeam | null>(null);

  // Closed by the answer landing, never by the click. A team is a name and
  // four boards, and the refusal that actually happens is somebody already
  // being in another team: closing on the click threw the whole team away and
  // then explained why. Same rule the placing editor learned.
  useActionSuccess(state, () => { setEditing(undefined); setPlacing(null); });

  const standings = useMemo(
    () => teamStandings(teams, fixtures), [teams, fixtures]);
  const standingOf = (id: number) =>
    standings.find((row) => row.teamId === id) ?? null;

  const send = (fields: Record<string, string>, extra?: (data: FormData) => void) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("eventId", String(eventId));
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    extra?.(data);
    startTransition(() => submit(data));
  };

  const boards = teams.map((team) => team.players.length);
  const uneven = boards.length > 1 && new Set(boards).size > 1;

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}
        sx={{ px: 2.25, py: 1.75, borderRadius: 2,
              border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        <FormControlLabel
          control={<Switch checked={teamEvent} disabled={busy}
            onChange={(e) => send({ intent: "team-event",
                                    on: e.target.checked ? "yes" : "no" })} />}
          label="Run this event as teams"
        />
        <Typography variant="caption" sx={{ color: tokens.inkMuted, maxWidth: "68ch" }}>
          {teamEvent
            ? "The draw is team against team, with a table for each pair of players inside it. Turn this off and it goes back to one player per table: the teams and their tables stay, they just stop being grouped."
            : "The draw becomes team against team, with a table for each pair of players inside it. Scores, armies and who may see a round all work exactly as they do now."}
        </Typography>
      </Stack>

      {teamEvent ? (
        <>
          <Stack direction="row" spacing={1.5} useFlexGap
            sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                              letterSpacing: "0.08em", color: tokens.inkMuted,
                              flex: 1, minWidth: 0 }}>
              {teams.length
                ? `${teams.length} ${teams.length === 1 ? "TEAM" : "TEAMS"}`
                : "NO TEAMS YET"}
            </Typography>

            <Button variant="contained" startIcon={<AddIcon />} disabled={busy}
              onClick={() => setEditing(null)}>
              New team
            </Button>
            {teams.length >= 2 ? (
              <LinkButton variant="outlined"
                href={`/clubs/${slug}/manage/events/${eventId}/pairings`}>
                Make the draw
              </LinkButton>
            ) : null}
          </Stack>

          {/* Said once, here, rather than refused at the draw: a team a player
              short is a real state on the morning of an event, and the club
              fixes it by finding somebody rather than by being blocked. */}
          {uneven ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Your teams do not all have the same number of boards. The draw
              still works, and the extra boards sit with nobody to play.
            </Typography>
          ) : null}

          <BusyOverlay busy={busy} variant="dim" label="Saving">
            {teams.length ? (
              <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                         gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                                sm: "repeat(2, minmax(0, 1fr))",
                                                lg: "repeat(3, minmax(0, 1fr))" } }}>
                {teams.map((team) => (
                  <TeamCard key={team.id} team={team} standing={standingOf(team.id)}
                    busy={busy}
                    onEdit={() => setEditing(team)}
                    onPlace={() => setPlacing(team)}
                    onRemove={() => setRemoving(team)} />
                ))}
              </Box>
            ) : (
              <EmptyState
                title="No teams yet"
                description="Make a team, give it a name, and list who plays on which board. Board one plays the other team's board one, so the order is the captain's call."
              />
            )}
          </BusyOverlay>
        </>
      ) : (
        <EmptyState
          title="This event runs one player per table"
          description="Turn teams on above and you can build a team of players, draw team against team, and record a result at both levels."
        />
      )}

      {editing !== undefined ? (
        <TeamDialog open team={editing} roster={roster} saving={busy}
          nextPosition={teams.length}
          onClose={() => setEditing(undefined)}
          onSave={(fields, rows) => {
            send(fields, (data) => {
              for (const row of rows) {
                data.append("playerName", row.name);
                data.append("playerProfileId", row.profileId);
              }
            });
          }} />
      ) : null}

      <PlaceDialog team={placing} saving={busy}
        onClose={() => setPlacing(null)}
        onSave={(fields) => send(fields)} />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this team?"
        body={removing
          ? `${removing.name} comes off the event, along with every fixture they are in and the tables under those. Scores on those tables go with them.`
          : ""}
        confirmLabel="Remove team" destructive busy={busy}
        onConfirm={() => {
          if (removing) send({ intent: "remove-team", teamId: String(removing.id) });
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
    </Stack>
  );
}
