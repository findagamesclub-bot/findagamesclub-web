"use client";

import { useState } from "react";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import MemberCodeField, { type Linked } from "@/components/results/MemberCodeField";
import type { Person } from "./AddPlaceDialog";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { DoorRow } from "@/utils/door-list";
import { tokens } from "@/lib/tokens";

/**
 * Correcting who is coming.
 *
 * Only the name, the address and the note: what was bought and what it cost
 * are the booking's own facts, and a club being able to edit a total after
 * somebody agreed to it is not a thing this app allows.
 */
export default function EditBookingDialog({
  row, slug, members = [], accountNames = {}, saving, onClose, onSave,
}: {
  row: DoorRow | null;
  /** For the member-code lookup, which works at any club. */
  slug: string;
  /**
   * The club's own approved members, who need no code. Empty on the club-wide
   * bookings list, which does not load a roster; the code field below still
   * works there, and a picker with nothing in it is a control offering to do
   * something it cannot.
   */
  members?: Person[];
  /** Linked accounts' own names by id, roster or not (0177's own lesson). */
  accountNames?: Record<string, string>;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: Record<string, string>) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  // Whose place this is. A booking made signed in already carries it, which
  // is the client's scenario 1; the other two are what this control is for.
  const [linked, setLinked] = useState<Linked | null>(null);

  useWhenChanged([row], () => {
    if (!row) return;
    setFullName(row.fullName);
    setEmail(row.email);
    setNotes(row.notes);
    // Only the id is stored, so a name is offered where the roster knows one
    // and left off where it does not. Echoing the name the club typed would
    // make a wrong link unspottable, which 0177 already paid for.
    setLinked(row.profileId
      ? { id: row.profileId,
          // The roster first, then every other account on this list. Somebody
          // linked by their member code is not a member of this club, which
          // is exactly when the roster lookup came back empty and the line
          // could only say "Attached to an account".
          name: members.find((m) => m.id === row.profileId)?.name
            ?? accountNames[row.profileId] }
      : null);
  });

  return (
    <Dialog open={Boolean(row)} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>Edit this booking</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* Who the place belongs to, above the name on the door, because
              the account is the thing the results and badges follow and the
              name is only what to call out on the day. A member picker for
              the club's own, and the code underneath for anybody else: the
              client's scenario 2 is somebody who "may not be a member of
              that club" and scenario 3 is somebody who is not one at all. */}
          {members.length ? (
          <Autocomplete<Person, false, false, false>
            options={members}
            value={linked?.id
              ? members.find((m) => m.id === linked.id) ?? null
              : null}
            onChange={(_event, value) =>
              setLinked(value ? { id: value.id, name: value.name } : null)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Whose place is it"
                helperText="A member of your club. Leave it empty for somebody who is not a member of your club." />
            )}
          />
          ) : null}

          <MemberCodeField
            slug={slug}
            linked={linked}
            onFound={(holder) => setLinked(holder)}
            onClear={() => setLinked(null)}
            unlinkedNote="Nobody's profile is behind this place, so no result from it reaches one."
          />

          <TextField label="Name" required fullWidth autoFocus value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            helperText="Who is actually coming. A member can book for somebody else." />

          <TextField label="Email" type="email" fullWidth value={email}
            onChange={(e) => setEmail(e.target.value)}
            helperText="Where their ticket emails go." />

          <TextField label="Notes" fullWidth multiline minRows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            helperText="What they told you when they booked. Only your team sees it." />

          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            What they bought and what it cost cannot be changed here. Cancel the place and
            let them book again if the tickets are wrong.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" disabled={!fullName.trim()}
          loading={saving} loadingPosition="start"
          aria-label={saving ? "Saving the booking" : undefined}
          onClick={() => onSave({
            fullName, email, notes,
            // Empty means nobody, which is a real answer and how a wrong link
            // is taken off. The code rides along because an account that is
            // nobody at this club is only attachable with one.
            memberId: linked?.id ?? "",
            memberCode: linked?.code ?? "",
          })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
