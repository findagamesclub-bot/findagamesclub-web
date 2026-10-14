"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { tokens } from "@/lib/tokens";
import type { EventTeam } from "@/types/eventTeams";

/**
 * Where a team finished, in the club's own words.
 *
 * Typed rather than worked out from the fixtures, because a final table needs
 * tiebreakers only the organiser knows and most team events have a rule the
 * running total cannot see. The table on the page is guidance; this is the
 * result.
 */
export default function PlaceDialog({ team, saving, onClose, onSave }: {
  team: EventTeam | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [rank, setRank] = useState("");
  const [placement, setPlacement] = useState("");
  const [score, setScore] = useState("");

  // A badge lands on an account, and a player typed in from a door booking
  // has none. Said here rather than on the card, because this is the screen
  // where somebody is about to be promised one: a club that placed a team of
  // four guests first and saw no badges would read it as broken.
  const adrift = (team?.players ?? []).filter((player) => !player.profileId).length;
  const all = team?.players.length ?? 0;

  useWhenChanged([team], () => {
    setRank(team?.finalRank ? String(team.finalRank) : "");
    setPlacement(team?.placement ?? "");
    setScore(team?.finalScore === null || team?.finalScore === undefined
      ? "" : String(team.finalScore));
  });

  return (
    <Dialog open={Boolean(team)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>{team ? `Place ${team.name}` : ""}</DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField label="Place" type="number" value={rank} autoFocus
            onChange={(e) => setRank(e.target.value)}
            slotProps={{ htmlInput: { min: 1, max: 999 } }}
            // Short enough to sit on one line under a 180px field. The rest
            // of what this box does is in the note below, where there is room
            // for it: a fifty-character helper under a narrow field wraps to
            // three lines and reads as a warning.
            helperText="1 for the winners."
            sx={{ maxWidth: 180 }} />

          {/* The overall figure beside the place, in whatever the format
              counts: match points, games won, a tally of its own. Optional,
              because plenty of formats place a team without one. */}
          <TextField label="Team score" type="number" value={score}
            onChange={(e) => setScore(e.target.value)}
            slotProps={{ htmlInput: { min: 0 } }}
            helperText="Optional."
            sx={{ maxWidth: 180 }} />

          <TextField label="What to call it" fullWidth value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 40 } }}
            helperText="Optional. Winners, Runners up, Best sports, and so on." />

          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            Leave the place empty to take one back off. A team placed first,
            second or third gives every player in it that badge, the same as an
            individual podium does.
          </Typography>

          {adrift ? (
            <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
              {adrift === all
                // Not "link them from the draw": the draw's own picker reads
                // the same roster, so if nobody there has an account there is
                // nothing to link to. Booking with an account is the only
                // thing that actually fixes it.
                ? `Nobody in this team is linked to a member account, so no badge can reach them. A player is linked when they book their place signed in.`
                : `${adrift} of the ${all} players here are not linked to a member account, so the badge reaches the other ${all - adrift}.`}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" disabled={saving}
          onClick={() => onSave({
            intent: "place-team",
            teamId: team ? String(team.id) : "",
            rank: rank.trim(),
            placement,
            score: score.trim(),
          })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
