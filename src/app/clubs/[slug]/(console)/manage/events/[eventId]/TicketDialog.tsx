"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { soldLabel, type TicketDraft } from "@/utils/event-tickets";
import { tokens } from "@/lib/tokens";

export type TicketTier = { key: string; label: string };

/**
 * One ticket type.
 *
 * The fields a sold type cannot change are disabled rather than hidden, with
 * the reason under them, because a club looking for the price box needs to
 * find it and be told why it will not move.
 */
export default function TicketDialog({
  open, row, taken, tiers, onClose, onSave,
}: {
  open: boolean;
  /** Null for a new one. */
  row: TicketDraft | null;
  taken: number;
  tiers: TicketTier[];
  onClose: () => void;
  onSave: (row: TicketDraft) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [draft, setDraft] = useState<TicketDraft>(
    row ?? { id: null, label: "", price: "", quantityAvailable: null,
             audience: "all", minimumTierKey: "" });

  // Reset each time the dialog opens, so the row being edited is the row shown.
  useEffect(() => {
    if (!open) return;
    setDraft(row ?? { id: null, label: "", price: "", quantityAvailable: null,
                      audience: "all", minimumTierKey: "" });
  }, [open, row]);

  const locked = taken > 0;
  const sold = soldLabel(taken, draft.quantityAvailable);

  // Held as a string so the box can be emptied: a number coerced on every
  // keystroke means the 0 cannot be backspaced away.
  const [cap, setCap] = useState("");
  useEffect(() => {
    if (open) setCap(row?.quantityAvailable === null || row?.quantityAvailable === undefined
      ? "" : String(row.quantityAvailable));
  }, [open, row]);

  const save = () => onSave({
    ...draft,
    label: draft.label.trim(),
    price: draft.price.trim(),
    quantityAvailable: cap.trim() === "" ? null : Math.max(0, Math.floor(Number(cap) || 0)),
    minimumTierKey: draft.audience === "members" ? draft.minimumTierKey : "",
  });

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{row ? draft.label || "Ticket" : "New ticket type"}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {sold ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {sold}. The price and who it is for are fixed while anybody holds one.
            </Typography>
          ) : null}

          <TextField label="What it is called" required autoFocus fullWidth
            value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 60 } }}
            helperText='Standard, Member, Under 16, and so on.' />

          <TextField label="Price" fullWidth disabled={locked}
            value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            helperText={locked
              ? "Sold, so this cannot change. Add a new ticket type instead."
              : 'Like "GBP 20". Leave it empty for free.'} />

          <TextField label="How many there are" type="number" fullWidth
            value={cap} onChange={(e) => setCap(e.target.value)}
            slotProps={{ htmlInput: { min: taken } }}
            helperText={taken
              ? `Empty means no limit. It cannot go below the ${taken} already gone.`
              : "Empty means no limit. Zero closes it without removing it."} />

          <TextField select label="Who can buy it" fullWidth disabled={locked}
            value={draft.audience}
            onChange={(e) => setDraft({ ...draft,
              audience: e.target.value === "members" ? "members" : "all" })}
            helperText={locked ? "Sold, so this cannot change." : undefined}>
            <MenuItem value="all">Anybody</MenuItem>
            <MenuItem value="members">Members of the club</MenuItem>
          </TextField>

          {draft.audience === "members" && tiers.length ? (
            <TextField select label="Minimum membership tier" fullWidth disabled={locked}
              value={draft.minimumTierKey}
              onChange={(e) => setDraft({ ...draft, minimumTierKey: e.target.value })}
              helperText={locked
                ? "Sold, so this cannot change."
                : "Anybody on this tier or above. Leave it as any tier for all members."}>
              <MenuItem value="">Any tier</MenuItem>
              {tiers.map((tier) => (
                <MenuItem key={tier.key} value={tier.key}>{tier.label}</MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!draft.label.trim()} onClick={save}>
          {row ? "Save ticket" : "Add ticket"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
