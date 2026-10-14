"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
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
import SubmitButton from "@/components/ui/SubmitButton";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { display, tokens, type Faction } from "@/lib/tokens";
import type { EditableTicketType } from "@/types/eventEditor";

export type Person = { id: string; name: string };

/**
 * Putting somebody on the list.
 *
 * The client asked for this on "Who is coming", and that is the right home:
 * it is the list it changes, and it is the screen a club already has open on
 * the day. A ticket desk on the event page answers "book my own place"; this
 * answers "somebody is standing in front of me with a twenty".
 *
 * The member picker is optional and says so, because most people at a door do
 * not have an account and inventing one for them helps nobody. Naming a member
 * is what makes it THEIR place: it reaches their own tickets, earns them
 * points, and is priced off their tier.
 */
export default function AddPlaceDialog({
  open, onClose, tickets, members, faction, busy, onSave,
}: {
  open: boolean;
  onClose: () => void;
  tickets: EditableTicketType[];
  /** Approved members, for the optional link to an account. */
  members: Person[];
  faction: Faction;
  busy: boolean;
  onSave: (fields: {
    profileId: string; fullName: string; email: string;
    ticketTypeId: number; quantity: number;
  }) => void;
}) {
  const small = useMediaQuery("(max-width:600px)");

  const [member, setMember] = useState<Person | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState<number | "">("");
  const [quantity, setQuantity] = useState("1");

  // Fresh every time it opens. A dialog that remembers the last person put on
  // the list is a dialog that adds them twice, and a club works down a queue
  // of people with this open.
  useWhenChanged([open], () => {
    if (!open) return;
    setMember(null);
    setName("");
    setEmail("");
    setTicket(tickets[0]?.id ?? "");
    setQuantity("1");
  });

  // Naming a member fills the name in, because the roster already knows it and
  // typing it again is a chance to spell it differently from their account.
  const pick = (next: Person | null) => {
    setMember(next);
    if (next) setName(next.name);
  };

  const chosen = tickets.find((t) => t.id === ticket) ?? null;
  const left = chosen?.quantityAvailable === null || chosen === null
    ? null
    : Math.max(0, (chosen.quantityAvailable ?? 0) - chosen.taken);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="sm" fullScreen={small}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
          Add somebody to the list
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* A refusal is said by the board's toast, which is how every other
            action in this console reports one. An Alert in here as well is
            the same sentence twice, and it sat directly above the button the
            refusal is asking somebody to press again. The dialog stays open
            with its typing intact, which is what makes the retry possible. */}
        <Stack spacing={2.5}>
          <Autocomplete<Person, false, false, false>
            options={members}
            value={member}
            onChange={(_event, value) => pick(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Member"
                helperText="Optional. Name one and the place is theirs: it shows on their tickets, earns them points, takes their tier's discount, and uses the address on their account." />
            )}
          />

          <TextField label="Name on the door" required fullWidth
            value={name} onChange={(event) => setName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            helperText="Who to call up on the day." />

          {/* Required unless a member is named, because 0015 has required an
              address on every booking since tickets existed: everything about
              one is posted to the address on it, so a place with nowhere to
              write to cannot be told the event was called off. A member's own
              account address is filled in by the database rather than here,
              so no member's address is shipped to this screen. */}
          <TextField label="Email" type="email" fullWidth required={!member}
            value={email} onChange={(event) => setEmail(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            helperText={member
              ? `Optional. Left blank, it goes to ${member.name.split(" ")[0]}'s own account address.`
              : "Where their reference goes, and where you tell them if the event changes."} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap
            sx={{ flexWrap: "wrap" }}>
            <TextField select label="Ticket" required
              value={ticket === "" ? "" : String(ticket)}
              onChange={(event) => setTicket(Number(event.target.value))}
              sx={{ minWidth: 220, flex: 1 }}>
              {tickets.map((type) => (
                <MenuItem key={type.id} value={String(type.id)}>
                  {type.label}{type.price ? ` · ${type.price}` : ""}
                </MenuItem>
              ))}
            </TextField>

            <TextField label="How many" type="number" required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 20 } }}
              sx={{ minWidth: 120 }} />
          </Stack>

          {/* What is actually left on the chosen ticket, so a club does not
              find out by being refused. */}
          <Typography sx={{ fontSize: "0.75rem", fontFamily: display,
                            lineHeight: 1.6, color: tokens.inkMuted }}>
            {left === null
              ? "This ticket has no limit on it."
              : `${left} of ${chosen?.label} left.`}
            {" "}Nothing is charged here: the place is reserved and the club
            takes the money its own way.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <SubmitButton label="Add them" pendingLabel="Adding them"
          size="medium"
          pending={busy}
          blocked={!name.trim() || ticket === "" || (!member && !email.trim())}
          sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}
          onClick={() => onSave({
            profileId: member?.id ?? "",
            fullName: name, email,
            ticketTypeId: Number(ticket),
            quantity: Math.max(1, Number(quantity) || 1),
          })} />
      </DialogActions>
    </Dialog>
  );
}
