"use client";

import { useActionState, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { teamAction, type TeamState } from "@/app/clubs/[slug]/(console)/manage/team/actions";
import { ROLE_LABEL, ROLE_SUMMARY, type ClubRole } from "@/utils/club-access";
import { display, mono, tokens } from "@/lib/tokens";
import type { TeamMember } from "@/services/clubTeam.service";

/**
 * One person on the team.
 *
 * The menu carries the two things that can be done to them. Both go through
 * the same form, so a role change and a removal cannot get out of step with
 * each other, and the row shows what they can do underneath their name rather
 * than making somebody remember what a helper is.
 */
export default function TeamMemberRow({
  member, clubId, slug, colour, canEdit,
}: {
  member: TeamMember;
  clubId: number;
  slug: string;
  /** The club's faction colour, on the avatar ring. Identity, not decoration. */
  colour: string;
  /** False for everybody but the owner, and for the owner's own row. */
  canEdit: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const intentRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState<TeamState, FormData>(teamAction, {});
  useActionToast(state);

  const swapTo: ClubRole = member.role === "manager" ? "helper" : "manager";

  const submit = (intent: string, role?: string) => {
    if (intentRef.current) intentRef.current.value = intent;
    if (roleRef.current) roleRef.current.value = role ?? "";
    setAnchor(null);
    formRef.current?.requestSubmit();
  };

  return (
    <Stack direction="row" spacing={1.5}
      sx={{ alignItems: "center", px: 2, py: 1.5, borderRadius: 1.5,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                 display: "grid", placeItems: "center",
                 border: `2px solid ${colour}`, color: colour }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700 }}>
          {member.name.slice(0, 2).toUpperCase()}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <NextLink href={`/members/${member.profileId}`}
          style={{ textDecoration: "none", color: "inherit" }}>
          <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700,
                            overflowWrap: "anywhere",
                            "&:hover": { color: tokens.brand } }}>
            {member.name}
          </Typography>
        </NextLink>
        <Typography variant="body2" sx={{ color: tokens.inkMuted, fontSize: "0.82rem" }}>
          {ROLE_SUMMARY[member.role]}
        </Typography>
      </Box>

      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted, flexShrink: 0,
                        display: { xs: "none", sm: "block" } }}>
        {ROLE_LABEL[member.role].toUpperCase()}
      </Typography>

      {canEdit ? (
        <>
          {/* Changing a role goes straight through with no confirmation, so
              the only sign it is happening is here. */}
          <IconButton onClick={(e) => setAnchor(e.currentTarget)} disabled={pending}
            aria-label={`Change what ${member.name} can do`} sx={{ flexShrink: 0 }}>
            {pending
              ? <CircularProgress size={18} thickness={5} sx={{ color: tokens.brass }} />
              : <MoreVertIcon />}
          </IconButton>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <MenuItem onClick={() => submit("role", swapTo)}>
              Make {ROLE_LABEL[swapTo].toLowerCase()}
            </MenuItem>
            <MenuItem onClick={() => { setAnchor(null); setConfirming(true); }}
              sx={{ color: tokens.danger }}>
              Remove from the team
            </MenuItem>
          </Menu>

          <ConfirmDialog
            open={confirming}
            title={`Remove ${member.name}?`}
            body={`They keep their membership of the club and anything they have posted. They will no longer be able to open the console.`}
            confirmLabel="Remove them"
            destructive
            busy={pending}
            // Not closed here. The dialog is told when the work is running and
            // shuts itself when it finishes; closing on the click that starts
            // it means the spinner never renders.
            onConfirm={() => submit("remove")}
            onClose={() => setConfirming(false)}
          />
        </>
      ) : null}

      <Box component="form" ref={formRef} action={formAction} sx={{ display: "none" }}>
        <input type="hidden" name="clubId" value={clubId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="profileId" value={member.profileId} />
        <input type="hidden" name="intent" ref={intentRef} defaultValue="" />
        <input type="hidden" name="role" ref={roleRef} defaultValue="" />
      </Box>
    </Stack>
  );
}
