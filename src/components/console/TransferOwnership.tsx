"use client";

import { useActionState, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { teamAction, type TeamState } from "@/app/clubs/[slug]/(console)/manage/team/actions";
import { ROLE_LABEL, type ClubRole } from "@/utils/club-access";
import { tokens } from "@/lib/tokens";

export type Candidate = { profileId: string; name: string; role: ClubRole | null };

/**
 * Handing the club on.
 *
 * Its own block at the bottom, outlined rather than contained, because it is
 * the one thing on this page that cannot be undone by the person doing it: the
 * new owner has to hand it back. The confirmation names the consequence and
 * asks for the club's name to be typed.
 */
export default function TransferOwnership({
  clubId, slug, clubName, candidates,
}: {
  clubId: number;
  slug: string;
  clubName: string;
  candidates: Candidate[];
}) {
  const [to, setTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<TeamState, FormData>(teamAction, {});
  useActionToast(state);

  const chosen = candidates.find((c) => c.profileId === to);

  return (
    <Box sx={{ px: 2.5, py: 2.5, borderRadius: 1.5,
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, mb: 0.5 }}>
        Hand the club on
      </Typography>
      <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2, maxWidth: 560 }}>
        The new owner gets the team page and the billing. You stay on as a manager,
        so you keep everything else.
      </Typography>

      {candidates.length === 0 ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Add somebody to the team first. Ownership can only go to a manager, a helper
          or an approved member.
        </Typography>
      ) : (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
          sx={{ alignItems: { sm: "flex-start" } }}>
          <TextField
            select
            label="Hand it to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            sx={{ minWidth: { xs: "100%", sm: 260 } }}
            helperText={chosen
              ? `${chosen.name} becomes the owner. You become a manager.`
              : "Managers, helpers and approved members"}
          >
            {candidates.map((c) => (
              <MenuItem key={c.profileId} value={c.profileId}>
                {c.name}{c.role ? ` · ${ROLE_LABEL[c.role]}` : ""}
              </MenuItem>
            ))}
          </TextField>

          {/* A stacking row centres a stretched child, so this says where it sits. */}
          <Button
            variant="outlined"
            color="error"
            disabled={!to || pending}
            onClick={() => setConfirming(true)}
            sx={{ alignSelf: { xs: "flex-start", sm: "center" }, mt: { sm: 1 } }}
          >
            Hand the club on
          </Button>
        </Stack>
      )}

      <TypedConfirmDialog
        open={confirming}
        title="Hand the club on?"
        body={chosen
          ? `${chosen.name} becomes the owner of ${clubName}. Billing emails go to them from now on, and you become a manager. Only they can hand it back.`
          : ""}
        phrase={clubName}
        confirmLabel="Hand it on"
        busy={pending}
        // Not closed here. The dialog stays up while the work runs and shuts
        // itself when it lands, which is the only way its spinner is seen.
        onConfirm={() => formRef.current?.requestSubmit()}
        onClose={() => setConfirming(false)}
      />

      <Box component="form" ref={formRef} action={formAction} sx={{ display: "none" }}>
        <input type="hidden" name="intent" value="transfer" />
        <input type="hidden" name="clubId" value={clubId} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="profileId" value={to} />
      </Box>
    </Box>
  );
}
