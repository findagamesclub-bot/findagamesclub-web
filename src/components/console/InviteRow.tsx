"use client";

import { useActionState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useActionToast } from "@/components/ui/Toaster";
import { teamAction, type TeamState } from "@/app/clubs/[slug]/(console)/manage/team/actions";
import { ROLE_LABEL } from "@/utils/club-access";
import { display, mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import type { TeamInvite } from "@/services/clubTeam.service";

/**
 * An invitation nobody has answered yet.
 *
 * An expired one is shown as expired rather than hidden. Somebody who clicked
 * a dead link asks the club what happened, and the club needs to be able to see
 * the same thing they did.
 */
export default function InviteRow({
  invite, clubId, slug,
}: {
  invite: TeamInvite;
  clubId: number;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(teamAction, {});
  useActionToast(state);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
      sx={{ alignItems: { xs: "flex-start", sm: "center" },
            px: 2, py: 1.5, borderRadius: 1.5,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 600,
                          overflowWrap: "anywhere" }}>
          {invite.who}
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.inkMuted, fontSize: "0.82rem" }}>
          {invite.expired
            ? `Expired ${shortDate(invite.expiresAt) ?? "recently"}. Withdraw it and send a new one.`
            : `Invited as a ${ROLE_LABEL[invite.role].toLowerCase()} on ${shortDate(invite.sentAt)}`}
        </Typography>
      </Box>

      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.1em", flexShrink: 0,
                        color: invite.expired ? tokens.danger : tokens.inkMuted }}>
        {invite.expired ? "EXPIRED" : "WAITING"}
      </Typography>

      <Box component="form" action={formAction} sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}>
        <input type="hidden" name="intent" value="revoke" />
        <input type="hidden" name="clubId" value={clubId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="inviteId" value={invite.id} />
        <Button type="submit" variant="outlined" size="small" loading={pending}
          loadingPosition="start">
          Withdraw
        </Button>
      </Box>
    </Stack>
  );
}
