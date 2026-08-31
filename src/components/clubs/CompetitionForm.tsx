"use client";

import { startTransition, useActionState, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useActionToast } from "@/components/ui/Toaster";
import { competitionAction, type CompetitionState }
  from "@/app/clubs/[slug]/competitions/actions";
import { COMPETITION_STATUSES, COMPETITION_TYPES } from "@/utils/competition-meta";
import type { ManagedCompetition } from "@/services/competitions.service";
import type { Faction } from "@/lib/tokens";

/**
 * Setting a competition up, or changing what it is.
 *
 * The table and the rounds are not here: a league exists first and fills up
 * afterwards, and a form asking for eight players before it will save a name
 * is a form nobody finishes.
 */
export default function CompetitionForm({
  clubId, slug, faction, competition, open, onClose,
}: {
  clubId: number;
  slug: string;
  faction: Faction;
  /** Null when creating. */
  competition: ManagedCompetition | null;
  open: boolean;
  onClose: () => void;
}) {
  const [state, submit, busy] = useActionState<CompetitionState, FormData>(
    competitionAction, {});
  useActionToast(state);
  const [seen, setSeen] = useState<CompetitionState | null>(null);

  // Close on success, stay open on a refusal so the typing survives it.
  if (state !== seen) {
    setSeen(state);
    if (state.notice) onClose();
  }

  const editing = Boolean(competition);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit competition" : "New competition"}</DialogTitle>

      <form action={(data) => startTransition(() => submit(data))}>
        <input type="hidden" name="intent" value={editing ? "edit" : "create"} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="clubId" value={clubId} />
        {competition ? (
          <input type="hidden" name="competitionId" value={competition.id} />
        ) : null}

        <DialogContent dividers>
          <Stack spacing={2.25}>
            <TextField name="title" label="Name" required fullWidth autoFocus
              defaultValue={competition?.title ?? ""}
              helperText="Autumn League, Summer Ladder, whatever your members call it."
              slotProps={{ htmlInput: { maxLength: 160 } }} />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField name="type" select label="Kind" fullWidth
                defaultValue={competition?.type ?? "league"}>
                {COMPETITION_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
              <TextField name="status" select label="State" fullWidth
                defaultValue={competition?.status ?? "active"}
                helperText="Upcoming and Active both show under Running now. Completed moves to Finished.">
                {COMPETITION_STATUSES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField name="game" label="Game" fullWidth
                defaultValue={competition?.game ?? ""} placeholder="Warhammer 40,000"
                slotProps={{ htmlInput: { maxLength: 120 } }} />
              <TextField name="season" label="Season" fullWidth
                defaultValue={competition?.season ?? ""} placeholder="Autumn 2026"
                slotProps={{ htmlInput: { maxLength: 80 } }} />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField name="startDate" type="date" label="Starts" fullWidth
                defaultValue={competition?.startDate ?? ""}
                slotProps={{ inputLabel: { shrink: true } }} />
              {/* Empty is a real answer: a ladder that runs on has no end. */}
              <TextField name="endDate" type="date" label="Ends" fullWidth
                defaultValue={competition?.endDate ?? ""}
                helperText="Leave blank if it runs on."
                slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>

            <TextField name="summary" label="What is it?" multiline minRows={3} fullWidth
              defaultValue={competition?.summary ?? ""}
              helperText="Shown on the club page under the name."
              slotProps={{ htmlInput: { maxLength: 2000 } }} />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button type="button" variant="text" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={busy} loadingPosition="start"
            sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}>
            {editing ? "Save" : "Create it"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
