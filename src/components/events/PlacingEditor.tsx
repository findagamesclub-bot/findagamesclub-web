"use client";

import { startTransition, useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { placingAction, type PlacingState }
  from "@/app/clubs/[slug]/events/[eventId]/placing-actions";
import { tokens } from "@/lib/tokens";
import type { EventPlacing } from "@/types/event";

export type PlacingTarget = { placing: EventPlacing | null };

/**
 * The club recording who finished where.
 *
 * A dialog per placing rather than an inline table of inputs: a club types
 * these in one sitting after packing the hall down, half of them on a phone,
 * and a row of six narrow fields is unusable on one. The next place is filled
 * in for them, because they are working down a printed sheet in order.
 *
 * Faction and detachment are free text. The linked army list legacy shows
 * against a placing comes out of the Army Builder, which is M3.
 */
export default function PlacingEditor({
  open, target, nextRank, roster, slug, eventKey, eventId, onClose,
}: {
  open: boolean;
  /** null placing means a new one. */
  target: PlacingTarget | null;
  nextRank: number;
  /** Club members, so a winner can be linked to their profile. */
  roster: { id: string; name: string }[];
  slug: string;
  eventKey: string;
  eventId: number;
  onClose: () => void;
}) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [state, submit, busy] = useActionState<PlacingState, FormData>(placingAction, {});
  useActionToast(state);

  const placing = target?.placing ?? null;
  const [profileId, setProfileId] = useState<string | null>(placing?.profileId ?? null);
  const [confirming, setConfirming] = useState(false);

  const send = (data: FormData) => {
    data.set("slug", slug);
    data.set("eventKey", eventKey);
    data.set("eventId", String(eventId));
    startTransition(() => submit(data));
  };

  const remove = () => {
    if (!placing) return;
    const data = new FormData();
    data.set("intent", "remove");
    data.set("placingId", String(placing.id));
    setConfirming(false);
    send(data);
    onClose();
  };

  return (
    <>
      <ConfirmDialog
        open={confirming}
        title="Remove this result?"
        body={placing
          ? `${placing.name} will no longer appear in the results for this event. `
            + "You can add them again afterwards."
          : ""}
        confirmLabel="Remove the result"
        cancelLabel="Keep it"
        destructive
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirming(false)}
      />

      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <EmojiEventsIcon sx={{ fontSize: 20, color: tokens.brass }} />
            <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
              {placing ? "Edit this result" : "Record a result"}
            </Typography>
          </Stack>
        </DialogTitle>

        <form action={send} key={placing?.id ?? "new"}>
          <input type="hidden" name="placingId" value={placing?.id ?? ""} />
          <input type="hidden" name="profileId" value={profileId ?? ""} />

          <DialogContent dividers>
            <Stack spacing={2.5}>
              {state.error ? <Alert severity="error">{state.error}</Alert> : null}

              <TextField
                name="rank" label="Place" type="number" required
                defaultValue={placing?.rank ?? nextRank}
                helperText="1 for the winner. The label is written for you."
                slotProps={{ htmlInput: { min: 1, max: 999 } }}
                sx={{ maxWidth: 180 }}
              />

              {/* Typed explicitly: a string defaultValue alongside object
                  options makes the inferred option type collapse to string. */}
              <Autocomplete<{ id: string; name: string }, false, false, true>
                freeSolo
                options={roster}
                defaultValue={placing?.name ?? ""}
                slotProps={{
                  paper: {
                    sx: { mt: 0.5, border: `1px solid ${tokens.rule}`,
                          boxShadow: "0 10px 30px rgba(16,27,45,0.18)" },
                  },
                }}
                getOptionLabel={(option) =>
                  typeof option === "string" ? option : option.name}
                onChange={(_event, value) =>
                  setProfileId(typeof value === "string" || !value ? null : value.id)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    name="name" label="Player" required
                    helperText={roster.length
                      ? "Pick a member so it shows on their profile, or type any name."
                      : "Whoever finished in this place."}
                    slotProps={{
                      ...params.slotProps,
                      htmlInput: { ...(params.slotProps?.htmlInput ?? {}), maxLength: 120 },
                    }}
                  />
                )}
              />

              <Box sx={{ display: "grid", gap: 2.5,
                         gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
                <TextField name="faction" label="Faction"
                  defaultValue={placing?.army?.factionLabel ?? ""}
                  slotProps={{ htmlInput: { maxLength: 80 } }} />
                <TextField name="detachment" label="Detachment"
                  defaultValue={placing?.army?.detachment ?? ""}
                  slotProps={{ htmlInput: { maxLength: 80 } }} />
              </Box>
              <Typography variant="caption" sx={{ color: tokens.inkMuted, mt: -1.5 }}>
                Both optional. The army list itself arrives with the Army Builder.
              </Typography>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
            {/* Destructive, so it sits away from Save rather than beside it. */}
            {placing ? (
              <Button onClick={() => setConfirming(true)} disabled={busy}
                sx={{ color: tokens.danger }}>
                Remove
              </Button>
            ) : <Box />}
            <Stack direction="row" spacing={1}>
              <Button onClick={onClose} disabled={busy}>Cancel</Button>
              <SubmitButton label="Save result" pendingLabel="Saving the result"
                size="medium" />
            </Stack>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
