"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import type { BookingState } from "@/app/clubs/[slug]/(console)/bookings/actions";
import type { Person } from "./OpponentField";
import { display, tokens, type Faction } from "@/lib/tokens";

/** The list floats over the field below it, so it needs an edge of its own. */
const paper = {
  paper: { sx: { mt: 0.5, border: `1px solid ${tokens.rule}`,
                 boxShadow: "0 10px 30px rgba(16,27,45,0.18)" } },
};

/**
 * The club puts somebody on a table.
 *
 * Nothing on the site could do this. `club_bookings_insert` pins
 * `booked_by = auth.uid()`, so the club's only move was to book the table
 * themselves and then edit who it was for, which is two steps and a wrong row
 * in between. The client reported it as a helper limitation; it was missing
 * for every role.
 *
 * Inside the Manage night dialog rather than a dialog of its own, because a
 * club works down a queue at a door and wants the tables filling up in front
 * of them while they do it. A dialog over a dialog hides the thing being
 * changed.
 *
 * Folded away until asked for: the common reason to open Manage night is to
 * cancel a table or hand one to somebody waiting, and three fields sitting
 * open underneath those make the dialog about this instead.
 */
export default function AddToNight({
  people, seatsFree, faction, busy, state, onSubmit,
}: {
  /** The club's approved members. A table is priced off a tier. */
  people: Person[];
  seatsFree: number;
  faction: Faction;
  busy: boolean;
  state: BookingState;
  onSubmit: (data: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [member, setMember] = useState<Person | null>(null);
  const [game, setGame] = useState("");
  const [against, setAgainst] = useState<Person | null>(null);
  const [againstName, setAgainstName] = useState("");

  // Folded back up and emptied when the answer lands, never on the click: a
  // refusal has to keep what was typed so the retry is one press. The club
  // then sees the new row in the list above, which is the confirmation.
  useActionSuccess(state, () => {
    setOpen(false);
    setMember(null);
    setGame("");
    setAgainst(null);
    setAgainstName("");
  });

  const send = () => {
    const data = new FormData();
    data.set("intent", "book-for");
    data.set("profileId", member?.id ?? "");
    data.set("memberName", member?.name ?? "");
    data.set("gameTitle", game);
    data.set("opponentProfileId", against?.id ?? "");
    data.set("opponentName", against ? against.name : againstName);
    onSubmit(data);
  };

  if (!open) {
    return (
      <Button variant="outlined" startIcon={<PersonAddIcon />} disabled={seatsFree <= 0}
        onClick={() => setOpen(true)} sx={{ alignSelf: "flex-start" }}>
        {seatsFree > 0 ? "Put somebody on a table" : "Every table is taken"}
      </Button>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Autocomplete<Person, false, false, false>
        options={people}
        value={member}
        onChange={(_event, value) => setMember(value)}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        slotProps={paper}
        renderInput={(params) => (
          <TextField {...params} label="Who the table is for" required
            helperText="Approved members only, because the table is priced off their tier." />
        )}
      />

      <TextField label="What they are playing" required fullWidth
        value={game} onChange={(event) => setGame(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 120 } }}
        helperText="Goes on the night's list, so the club can see the room at a glance." />

      <Autocomplete<Person, false, false, true>
        freeSolo
        options={people}
        value={against}
        slotProps={paper}
        getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
        isOptionEqualToValue={(a, b) =>
          typeof a !== "string" && typeof b !== "string" && a.id === b.id}
        onChange={(_event, value) => {
          setAgainst(typeof value === "string" || !value ? null : value);
          if (typeof value === "string") setAgainstName(value);
          if (!value) setAgainstName("");
        }}
        // `onChange` fires on a pick and on a clear and never on a keystroke,
        // so typing a guest's name over a picked member left the member's id
        // on the form and the game was filed against them. Paid for once on
        // the booking's own opponent field (0178).
        onInputChange={(_event, value, reason) => {
          if (reason !== "input") return;
          setAgainst(null);
          setAgainstName(value);
        }}
        renderInput={(params) => (
          <TextField {...params} label="Playing against"
            helperText="Optional. Pick a member so the game counts for both of them, or type a guest's name." />
        )}
      />

      <Typography sx={{ fontFamily: display, fontSize: "0.75rem",
                        lineHeight: 1.6, color: tokens.inkMuted }}>
        Priced off their own tier, exactly as if they had booked it themselves.
        No loyalty points are spent, because that is their choice to make, and
        they still earn the points for the table. They are told it is booked.
      </Typography>

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        <SubmitButton label="Book their table" pendingLabel="Booking their table"
          size="medium" pending={busy}
          blocked={!member || !game.trim()}
          sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}
          onClick={send} />
        <Button onClick={() => setOpen(false)} disabled={busy}
          sx={{ color: tokens.inkMuted }}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
