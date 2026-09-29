"use client";

import { useActionState, useState, useTransition } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
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
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { recordResultAction, clearResultAction, type ResultState }
  from "@/app/account/games/actions";
import MatchContextFields from "./MatchContextFields";
import ArmyFields from "@/components/results/ArmyFields";
import { useCatalogue } from "@/hooks/useCatalogue";
import { type ResultArmy } from "@/utils/result-army";
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
  // Wider than the rest of the site's dialogs, and the whole screen on a
  // phone. A result is eleven fields per side once the army is open, and at
  // 600px the cascade read as a column of boxes with no relationship to each
  // other. Rule 5: editing goes in a dialog, and a dialog that has to hold a
  // form gets the room for it.
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [open, setOpen] = useState(false);

  // Started from what was recorded, never from an empty army: saving an empty
  // one deletes the row, so a dialog that forgot last week's army would throw
  // it away the moment somebody corrected a score.
  const [mine, setMine] = useState<ResultArmy>(game.armies.mine);
  const [theirs, setTheirs] = useState<ResultArmy>(game.armies.theirs);
  const [mission, setMission] = useState(game.mission);
  const [deployment, setDeployment] = useState(game.deployment);
  const [terrain, setTerrain] = useState(game.terrain);
  const [confirmation, setConfirmation] = useState(game.confirmation);

  /**
   * Take the server's version whenever this is shut.
   *
   * Every one of these is a `useState` initialiser, which runs once when the
   * card mounts and never again. This dialog is mounted for every game on the
   * page, so a result somebody else changed -- the club settling it, the other
   * player correcting it -- never reached the fields: the page re-rendered with
   * the new data and the dialog went on showing what it captured at load. It
   * cost a disposition the club had set and would have written the stale value
   * back on the next save.
   *
   * Only while closed, because adopting new props under somebody who is typing
   * would throw their work away. `game` is a fresh object on every server
   * render, so the reference is the signal that something arrived.
   */
  const [seen, setSeen] = useState(game);
  if (!open && seen !== game) {
    setSeen(game);
    setMine(game.armies.mine);
    setTheirs(game.armies.theirs);
    setMission(game.mission);
    setDeployment(game.deployment);
    setTerrain(game.terrain);
    setConfirmation(game.confirmation);
  }

  // Settled or disputed results belong to the club. Saying so up front beats a
  // form that accepts your typing and then refuses on save.
  const readOnly = game.locked && !canManageClub;

  // Fetched on the first open rather than shipped with the page. A club that
  // does not run the builder has no builder to fetch, and sees the two free
  // text boxes it has always seen.
  const { catalogue, loading, failed } = useCatalogue(game.builder, open);

  const [state, submit, busy] = useActionState<ResultState, FormData>(recordResultAction, {});
  const [clearState, clear, clearing] = useActionState<ResultState, FormData>(clearResultAction, {});

  // Clearing is dispatched from a click rather than through a form action, so
  // it needs a transition. Without one React warns and `clearing` never flips,
  // which means the button's spinner never shows.
  const [, startClear] = useTransition();
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
  useActionSuccess(state, () => setOpen(false));
  useActionSuccess(clearState, () => setOpen(false));

  const done = game.myScore !== null;

  return (
    <>
      <Button size="small" variant={done ? "text" : "outlined"}
        startIcon={<EditNoteIcon sx={{ fontSize: 17 }} />}
        onClick={() => setOpen(true)}
        sx={done ? undefined : { color: tokens.ink, borderColor: tokens.brass }}>
        {done ? "Edit result" : "Add the result"}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 2 } } }}>
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

              {/* A club that does not run the builder sees the two boxes it
                  has always seen. Nothing about this dialog changes for them,
                  which is the point of the switch being the club's. */}
              <ArmyFields
                builder={game.builder} catalogue={catalogue}
                loading={loading} failed={failed}
                one={mine} two={theirs}
                onOne={setMine} onTwo={setTheirs}
                twoTitle={`${game.opponentName}'s army`}
                fallback={
                  <Stack direction="row" spacing={2}>
                    <TextField name="myArmy" label="Your army" fullWidth
                      defaultValue={game.myArmy} placeholder="Death Guard" />
                    <TextField name="theirArmy" label="Their army" fullWidth
                      defaultValue={game.theirArmy} placeholder="Custodes" />
                  </Stack>
                }
              />

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
                  startClear(() => clear(data));
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
