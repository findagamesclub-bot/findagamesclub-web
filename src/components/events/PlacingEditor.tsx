"use client";

import { startTransition, useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
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
import PlacingArmyFields from "./PlacingArmyFields";
import PlacingPlayerField from "./PlacingPlayerField";
import MemberCodeField from "@/components/results/MemberCodeField";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { useCatalogue } from "@/hooks/useCatalogue";
import { usePlacingArmy } from "@/hooks/usePlacingArmy";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { placingAction, type PlacingState }
  from "@/app/clubs/[slug]/(console)/events/[eventId]/placing-actions";
import { tokens } from "@/lib/tokens";
import type { EventPlacing } from "@/types/event";
import type { Builder, MemberList } from "@/services/resultArmies.service";

export type PlacingTarget = { placing: EventPlacing | null };

/**
 * The club recording who finished where.
 *
 * A dialog per placing rather than an inline table of inputs: a club types
 * these in one sitting after packing the hall down, half of them on a phone,
 * and a row of six narrow fields is unusable on one. The next place is filled
 * in for them, because they are working down a printed sheet in order.
 *
 * The army is free text at a club with the builder off, and the same cascade
 * as every other result screen at one that runs it. Picking a member also
 * offers whatever they have built in the Army Builder, which is what the
 * client asked for and what the podium card has been able to draw since
 * Milestone 2 with nothing ever writing it.
 */
export default function PlacingEditor({
  open, target, nextRank, roster, slug, eventKey, eventId, onClose,
  builder = null, lists = [],
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
  /** Null at a club that does not record armies. */
  builder?: Builder | null;
  /** Every list the people on this event's results have built here. */
  lists?: MemberList[];
}) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [state, submit, busy] = useActionState<PlacingState, FormData>(placingAction, {});
  useActionToast(state);

  const placing = target?.placing ?? null;
  const [confirming, setConfirming] = useState(false);

  // Fetched when the dialog opens rather than with the page: an event's results
  // are read far more often than they are typed in.
  const { catalogue, loading, failed } = useCatalogue(builder, open);

  // Everything the army half of this dialog holds, including the reset that
  // follows whichever placing was opened. The form itself is keyed on the same
  // id, which is what resets the plain fields.
  const { linked, setLinked, profileId, army, setArmy, listId, pickList, theirLists } =
    usePlacingArmy(open, placing, lists);

  const send = (data: FormData) => {
    data.set("slug", slug);
    data.set("eventKey", eventKey);
    data.set("eventId", String(eventId));
    startTransition(() => submit(data));
  };

  // Closed by the answer landing, not by the click, for both of them. Saving
  // closed on neither, so a club working down a printed results sheet
  // dismissed this by hand after every place; removing closed on the click,
  // which took the dialog off the screen before the work had happened and left
  // the row sitting there until the toast caught up.
  useActionSuccess(state, () => { setConfirming(false); onClose(); });

  const remove = () => {
    if (!placing) return;
    const data = new FormData();
    data.set("intent", "remove");
    data.set("placingId", String(placing.id));
    send(data);
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
          {/* The server checks the code itself rather than trusting that the
              browser resolved it, so it has to travel with the save. */}
          <input type="hidden" name="memberCode" value={linked?.code ?? ""} />

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

              <Box>
                <PlacingPlayerField roster={roster} name={placing?.name ?? ""}
                  onPick={setLinked} />
                <MemberCodeField
                  slug={slug} linked={linked} onFound={setLinked}
                  onClear={() => setLinked(null)}
                  unlinkedNote={"Leave it and the result still shows, under this "
                    + "name, with nobody's profile behind it."}
                />
              </Box>

              <PlacingArmyFields
                builder={builder} catalogue={catalogue}
                loading={loading} failed={failed}
                placing={placing} army={army} onChange={setArmy}
                lists={theirLists} listId={listId}
                playerNamed={profileId !== null} onList={pickList}
              />
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
