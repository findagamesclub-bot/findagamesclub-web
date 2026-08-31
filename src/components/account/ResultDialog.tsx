"use client";

import { useActionState, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { useActionToast } from "@/components/ui/Toaster";
import { recordResultAction, clearResultAction, type ResultState }
  from "@/app/account/games/actions";
import MatchContextFields from "./MatchContextFields";
import { confirmationLabel, toConfirmation } from "@/utils/result-meta";
import { mono, tokens } from "@/lib/tokens";
import type { MyGame } from "@/services/games.service";

/**
 * Enter what happened.
 *
 * Always "you" on the left and them on the right, whoever booked the table.
 * The row underneath stores it in the booking's own order; turning it round is
 * the service's job, so neither player has to think about who booked.
 */
export default function ResultDialog({
  game, canManageClub = false,
}: {
  game: MyGame;
  /** The club may set the result state, and may edit a settled one. */
  canManageClub?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mission, setMission] = useState(game.mission);
  const [deployment, setDeployment] = useState(game.deployment);
  const [terrain, setTerrain] = useState(game.terrain);
  const [confirmation, setConfirmation] = useState(game.confirmation);

  // Settled or disputed results belong to the club. Saying so up front beats a
  // form that accepts your typing and then refuses on save.
  const readOnly = game.locked && !canManageClub;

  const [state, submit, busy] = useActionState<ResultState, FormData>(recordResultAction, {});
  const [clearState, clear, clearing] = useActionState<ResultState, FormData>(clearResultAction, {});
  useActionToast(state);
  useActionToast(clearState);

  /**
   * Close on success, stay open on a refusal.
   *
   * This used to close on click, before the save had run, so a refused save
   * threw away everything typed and left only a toast. Derived during render
   * rather than in an effect: an effect would close it a frame later and trip
   * the set-state-in-effect rule.
   */
  const [seen, setSeen] = useState<ResultState | null>(null);
  if (state !== seen) {
    setSeen(state);
    if (state.notice) setOpen(false);
  }

  const [seenClear, setSeenClear] = useState<ResultState | null>(null);
  if (clearState !== seenClear) {
    setSeenClear(clearState);
    if (clearState.notice) setOpen(false);
  }

  const done = game.myScore !== null;

  return (
    <>
      <Button size="small" variant={done ? "text" : "outlined"}
        startIcon={<EditNoteIcon sx={{ fontSize: 17 }} />}
        onClick={() => setOpen(true)}
        sx={done ? undefined : { color: tokens.ink, borderColor: tokens.brass }}>
        {done ? "Edit result" : "Add the result"}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}>
        <DialogTitle sx={{ fontSize: "1.25rem" }}>
          {game.title}
          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
            {`${game.club.name.toUpperCase()} · VS ${game.opponentName.toUpperCase()}`}
            {game.myScore !== null ? ` · ${confirmationLabel(game.confirmation).toUpperCase()}` : ""}
          </Typography>
        </DialogTitle>

        <form action={submit}>
          <input type="hidden" name="bookingId" value={game.id} />
          <input type="hidden" name="iBooked" value={String(game.iBooked)} />
          <input type="hidden" name="mission" value={mission} />
          <input type="hidden" name="deployment" value={deployment} />
          <input type="hidden" name="terrain" value={terrain} />
          <input type="hidden" name="confirmation" value={canManageClub ? confirmation : ""} />

          <DialogContent dividers>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={2}>
                <TextField name="myScore" label="Your score" type="number" fullWidth
                  defaultValue={game.myScore ?? ""} autoFocus
                  slotProps={{ htmlInput: { min: 0, step: "0.5" } }} />
                <TextField name="theirScore" label={`${game.opponentName}'s score`}
                  type="number" fullWidth defaultValue={game.theirScore ?? ""}
                  slotProps={{ htmlInput: { min: 0, step: "0.5" } }} />
              </Stack>

              <Stack direction="row" spacing={2}>
                <TextField name="myArmy" label="Your army" fullWidth
                  defaultValue={game.myArmy} placeholder="Death Guard" />
                <TextField name="theirArmy" label="Their army" fullWidth
                  defaultValue={game.theirArmy} placeholder="Custodes" />
              </Stack>

              <MatchContextFields
                mission={mission} deployment={deployment} terrain={terrain}
                confirmation={confirmation} canManageClub={canManageClub}
                onMission={setMission} onDeployment={setDeployment}
                onTerrain={setTerrain}
                onConfirmation={(value) => setConfirmation(toConfirmation(value))}
              />

              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {readOnly
                  ? "The club has settled this result, so it can no longer be changed here."
                  : game.confirmation === "confirmed"
                    ? "Both players have agreed this. Editing it puts it back to submitted."
                    : "Either player can record this, and either can correct it. Everything but the scores is optional."}
              </Typography>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            {done ? (
              <Button type="button" variant="text" loading={clearing}
                disabled={clearing || busy || readOnly}
                onClick={() => {
                  const data = new FormData();
                  data.set("bookingId", String(game.id));
                  clear(data);
                }}
                sx={{ color: tokens.danger, mr: "auto" }}>
                Clear it
              </Button>
            ) : null}
            {/* Closing mid-save would lose the typing if the save is refused. */}
            <Button type="button" variant="text" disabled={busy || clearing}
              onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={busy}
              loadingPosition="start" disabled={readOnly || clearing}>
              Save result
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
