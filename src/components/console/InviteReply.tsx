"use client";

import { useRouter } from "next/navigation";

import { useActionState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { useActionToast } from "@/components/ui/Toaster";
import SubmitButton from "@/components/ui/SubmitButton";
import { inviteReplyAction, type TeamState } from "@/app/clubs/[slug]/(console)/manage/team/actions";

/**
 * Accept or decline, from the link in the invitation.
 *
 * Both are real submissions rather than one button and a link away, because
 * declining should be as easy as accepting. Nobody should have to ignore an
 * invitation to refuse it.
 */
export default function InviteReply({ token, clubSlug }: { token: string; clubSlug: string }) {
  // A client navigation, not `window.location`: a hard load throws the whole
  // running app away and downloads it again, for a move between two pages of
  // the same app. Nothing cached can be stale here, because somebody who has
  // just accepted an invite has never been able to open that console before.
  const router = useRouter();

  const [state, formAction] = useActionState<TeamState, FormData>(
    async (prev, data) => {
      const next = await inviteReplyAction(prev, data);
      // Straight into the console on acceptance: the reason they clicked the
      // link is to get in, and a success toast on a dead-end page is not that.
      if (next.notice && String(data.get("reply")) === "accept") {
        router.push(`/clubs/${clubSlug}/manage`);
      }
      return next;
    },
    {},
  );
  useActionToast(state);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
      <Box component="form" action={formAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="reply" value="accept" />
        <SubmitButton label="Accept and open the console" pendingLabel="Accepting" />
      </Box>
      <Box component="form" action={formAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="reply" value="decline" />
        <SubmitButton label="No thanks" pendingLabel="Declining" variant="outlined" />
      </Box>
    </Stack>
  );
}
