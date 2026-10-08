"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

/**
 * Who a round the club has put on show is actually for.
 *
 * The client read "Members can see this draw" and asked for an option letting
 * non-members see it too, because some events sell to the street. The gate was
 * never membership: it is a ticket, so somebody who booked without joining has
 * always seen the draw and the label was the whole misunderstanding. Both
 * audiences are named in words here for that reason, rather than one being
 * implied by a switch being off.
 *
 * Two radio rows rather than a switch, because a switch has a name and a
 * silence and the silent half is the one that caused this. The event's own
 * finishing makes it public either way, which is 0065's rule about the Best
 * Coast link and is said underneath rather than left to be discovered.
 */
export default function DrawAudience({
  open, busy, onChange,
}: {
  open: boolean;
  busy: boolean;
  onChange: (open: boolean) => void;
}) {
  return (
    <Stack spacing={1} sx={{ pt: 2, borderTop: `1px solid ${tokens.rule}` }}>
      <Typography component="h2" sx={{ fontFamily: mono, fontSize: "0.66rem",
                                       fontWeight: 700, letterSpacing: "0.1em",
                                       color: tokens.inkMuted }}>
        WHO SEES A ROUND YOU HAVE SHOWN
      </Typography>

      <RadioGroup value={open ? "anybody" : "ticket"}
        onChange={(event) => onChange(event.target.value === "anybody")}
        sx={{ gap: 0.25 }}>
        <FormControlLabel value="ticket" disabled={busy}
          control={<Radio size="small" />}
          label={
            <Typography variant="body2">
              Everybody coming. Anyone holding a ticket, member or not, and your team.
            </Typography>
          } />
        <FormControlLabel value="anybody" disabled={busy}
          control={<Radio size="small" />}
          label={
            <Typography variant="body2">
              Anybody. The draw sits on the event page for the whole internet.
            </Typography>
          } />
      </RadioGroup>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        A round you have not shown is only ever yours, whichever of these is
        picked. Once the event has finished the draw is public either way, the
        same as the standings.
      </Typography>
    </Stack>
  );
}
