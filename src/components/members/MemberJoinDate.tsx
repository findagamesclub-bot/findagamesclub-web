"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { joinDateProblem, JOIN_DATE_MESSAGES, yearsBetween } from "@/utils/join-date";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * When this member actually joined.
 *
 * A club that has been running ten years lists itself, approves forty people
 * who have been coming since 2015, and `approve` stamps today on every one of
 * them: the roster reads "joined this morning" for the whole room. This is the
 * one control that was missing, not the one capability.
 *
 * The helper counts the years as the date moves, which is the point of having
 * it here rather than in a settings page somewhere. Correcting forty dates is
 * a bulk job done from a printed list, and "11 years at the club" is how
 * somebody knows they typed 2015 and not 2051 before they press Save.
 *
 * Controlled, like the tier picker beside it. An uncontrolled field would be
 * emptied by React 19's form reset the moment a date is refused, which is the
 * one time the typing matters.
 */
export default function MemberJoinDate({
  membershipId, slug, joinedAt, today, busy, send,
}: {
  membershipId: number;
  slug: string;
  /** What is stored. Null on a membership nobody has approved yet. */
  joinedAt: string | null;
  /** The club's own day, never the browser's. */
  today: string;
  busy: boolean;
  send: (data: FormData) => void;
}) {
  const saved = (joinedAt ?? "").slice(0, 10);
  const [picked, setPicked] = useState(saved);

  // Re-seeded when the server's answer moves, so a saved date leaves the box
  // agreeing with the row rather than holding what was on screen before.
  useWhenChanged([saved], () => setPicked(saved));

  const moved = picked !== saved;
  const problem = joinDateProblem(picked, today);
  const years = problem ? null : yearsBetween(picked, today);

  return (
    <Box component="form" action={send}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="slug" value={slug} />

      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
        MEMBER SINCE
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          type="date" name="joinedAt" size="small" label="Joined" fullWidth
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
          error={moved && problem !== null}
          // The years are the feedback, so they sit where the field's own
          // guidance sits. A refusal replaces them, because a date that
          // cannot be saved has no tenure to report.
          helperText={moved && problem
            ? JOIN_DATE_MESSAGES[problem]
            : years === null
              ? "Nothing recorded yet."
              : years === 0
                ? "Joined this year."
                : `${years} ${years === 1 ? "year" : "years"} at the club.`}
          slotProps={{
            // A date picker that will not accept today is a date picker that
            // refuses the commonest answer, so the ceiling is the club's own
            // day rather than yesterday.
            htmlInput: { max: today, min: "1900-01-01" },
            inputLabel: { shrink: true },
          }}
        />
        {/* One spinner marks one action. `busy` is shared with the tier and
            payment forms in this dialog, so without `moved` this button would
            spin for work nobody started here. */}
        <Button type="submit" variant="outlined"
          loading={busy && moved} loadingPosition="start"
          disabled={!moved || problem !== null} sx={{ flexShrink: 0 }}>
          Save
        </Button>
      </Stack>

      {/* Helper size, not `caption`. This theme sets caption at 0.9rem and
          leaves FormHelperText at 0.75rem, so a caption directly under the
          field's own helper line steps back UP and becomes the loudest thing
          in the section. A note about a field is the weight of that field's
          own helper text. */}
      <Typography sx={{ display: "block", mt: 1, fontFamily: display,
                        fontSize: "0.75rem", lineHeight: 1.5,
                        color: tokens.inkMuted }}>
        Year badges are given from this date. One somebody already has stays
        until you take it off on the Badges page.
      </Typography>
    </Box>
  );
}
