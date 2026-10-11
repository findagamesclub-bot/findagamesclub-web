"use client";

import { useActionState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { useActionToast } from "@/components/ui/Toaster";
import { claimNamesAction, type ClaimState }
  from "@/app/clubs/[slug]/(console)/events/[eventId]/claim-actions";
import { display, tokens } from "@/lib/tokens";

/**
 * The morning after a tournament.
 *
 * A member code answers the door; this answers everything the door missed. An
 * organiser running fifty people through a hall types names off a sheet and
 * will not stop to collect fifty codes, so most of a weekend ends up as text
 * with no account behind it. The person who most wants that fixed is the one
 * whose badge is missing.
 *
 * Only drawn for somebody holding a ticket whose own name is on a row here,
 * which the database decides rather than this component. One press takes all
 * of them, because five rounds and a placing is six presses for one obvious
 * answer, and six presses is how somebody gives up halfway.
 */
export default function ClaimNamesNotice({
  slug, eventKey, eventId, count,
}: {
  slug: string;
  eventKey: string;
  eventId: number;
  count: number;
}) {
  const [state, submit, busy] = useActionState<ClaimState, FormData>(
    claimNamesAction, {});
  useActionToast(state);

  if (count < 1) return null;

  return (
    <Stack component="form" action={submit}
      direction={{ xs: "column", sm: "row" }} spacing={1.5}
      sx={{
        mt: 2.5, px: 2.25, py: 1.75, borderRadius: 2,
        alignItems: { sm: "center" },
        border: "1px solid rgba(184,134,43,0.45)",
        backgroundColor: tokens.brassSoft,
      }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="eventKey" value={eventKey} />
      <input type="hidden" name="eventId" value={String(eventId)} />

      <PersonAddAlt1Icon aria-hidden
        sx={{ fontSize: 20, color: "#8a6418", display: { xs: "none", sm: "block" } }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: display, fontWeight: 700, color: "#3f2e0b" }}>
          Your name is here with no account behind it
        </Typography>
        <Typography variant="body2" sx={{ color: "#5c4310" }}>
          {count === 1
            ? "One result on this page is under your name and is not on your profile."
            : `${count} results on this page are under your name and are not on your profile.`}
          {" Attach them and they count towards your record and your badges."}
        </Typography>
      </Box>

      <Button type="submit" variant="contained" loading={busy}
        sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}>
        That&apos;s me
      </Button>
    </Stack>
  );
}
