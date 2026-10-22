"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import StatusChip from "@/components/ui/StatusChip";
import { mono, tokens } from "@/lib/tokens";

/**
 * Whether this person can use this club.
 *
 * The client's words: *"club owner should be able to suspend a member from
 * their club. This would not suspend the members account overall and
 * membership to other clubs, but would suspend the member from being able to
 * access the club in question."*
 *
 * It is a membership status, so `is_club_member` answers false and the board,
 * the bookings, the shop and everything else behind the club's door close on
 * their own. Nothing else about the person moves: their account, their other
 * clubs and their own data are exactly as they were.
 *
 * Last in the dialog, under the money, because it is the one control here
 * that ends something. Same order every card in this console uses.
 */
export default function MemberAccess({
  membershipId, slug, memberName, suspended, reason, onTeam, busy, send,
}: {
  membershipId: number;
  slug: string;
  memberName: string;
  suspended: boolean;
  reason: string;
  /** On the club's own team, so SQL refuses this and the control is not shown. */
  onTeam: boolean;
  busy: boolean;
  send: (data: FormData) => void;
}) {
  const [asking, setAsking] = useState(false);
  // Uncontrolled: a controlled MUI `multiline` field drops the character that
  // wraps a line, which 0185 measured rather than guessed at.
  const why = useRef<HTMLTextAreaElement>(null);

  const submit = (on: boolean) => {
    const data = new FormData();
    data.set("membershipId", String(membershipId));
    data.set("slug", slug);
    data.set("on", on ? "yes" : "no");
    data.set("reason", on ? (why.current?.value ?? "") : "");
    send(data);
  };

  if (onTeam) {
    return (
      <Box sx={{ pt: 0.5 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                          letterSpacing: "0.1em", color: tokens.inkMuted, mb: 0.75 }}>
          ACCESS TO THIS CLUB
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {memberName} is on your team, so pausing them is not the way to take
          them off. Change their role on the Team page instead.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 0.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          ACCESS TO THIS CLUB
        </Typography>
        {suspended ? <StatusChip label="Paused" tone="down" /> : null}
      </Stack>

      {suspended ? (
        <Stack spacing={1.25} sx={{ alignItems: "flex-start" }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {reason
              ? `They cannot use the club. You told them: "${reason}"`
              : "They cannot use the club."}
            {" "}Their account and any other club they belong to are untouched.
          </Typography>
          <Button variant="outlined" size="small" loading={busy}
            loadingPosition="start" onClick={() => submit(false)}
            sx={{ borderColor: tokens.rule, color: tokens.ink }}>
            Put their access back
          </Button>
        </Stack>
      ) : asking ? (
        <Stack spacing={1.25}>
          <TextField label="Why" fullWidth multiline minRows={2} inputRef={why}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText={`${memberName} reads this, so write it for them.`} />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" loading={busy}
              loadingPosition="start" onClick={() => submit(true)}
              sx={{ bgcolor: tokens.danger, "&:hover": { bgcolor: tokens.danger } }}>
              Pause their access
            </Button>
            <Button variant="text" size="small" disabled={busy}
              onClick={() => setAsking(false)} sx={{ color: tokens.inkMuted }}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Pausing takes away everything behind your club&apos;s door: the board,
            bookings, the shop and members-only posts. It does not touch their
            account or any other club they belong to, and you can put it back.
          </Typography>
          <Button variant="text" size="small" onClick={() => setAsking(true)}
            sx={{ color: tokens.danger, ml: -1 }}>
            Pause their access
          </Button>
        </Stack>
      )}
    </Box>
  );
}
