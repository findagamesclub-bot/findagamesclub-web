"use client";

import { useActionState, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import RolePicker from "./RolePicker";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { teamAction, type TeamState } from "@/app/clubs/[slug]/(console)/manage/team/actions";
import { tokens } from "@/lib/tokens";

export type RosterPerson = { profileId: string; fullName: string };

/**
 * Asking somebody to help run the club.
 *
 * Two ways in, because clubs have both: the people already on the roster, and
 * the treasurer who has never made an account. Picking from the roster is
 * first because it is the common case and it cannot be mistyped.
 */
export default function InviteDialog({
  clubId, slug, roster,
}: {
  clubId: number;
  slug: string;
  roster: RosterPerson[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"roster" | "email">("roster");
  const [person, setPerson] = useState<RosterPerson | null>(null);
  const [role, setRole] = useState("helper");
  const fullScreen = useMediaQuery("(max-width:600px)");

  const [state, formAction] = useActionState<TeamState, FormData>(
    async (prev, data) => {
      const next = await teamAction(prev, data);
      if (next.notice) { setOpen(false); setPerson(null); }
      return next;
    },
    {},
  );
  useActionToast(state);

  return (
    <>
      <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setOpen(true)}>
        Invite somebody
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth
        fullScreen={fullScreen}>
        <DialogTitle>Invite somebody to help</DialogTitle>
        <form action={formAction}>
          <input type="hidden" name="intent" value="invite" />
          <input type="hidden" name="clubId" value={clubId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="profileId" value={tab === "roster" ? person?.profileId ?? "" : ""} />

          <DialogContent>
            {/* A choice inside a dialog, so real tabs rather than NavTabs,
                which is link navigation and would leave the dialog. */}
            <Tabs
              value={tab}
              onChange={(_, next) => setTab(next as "roster" | "email")}
              aria-label="How to invite them"
              sx={{ mb: 2.5, borderBottom: `1px solid ${tokens.rule}`,
                    "& .MuiTabs-indicator": { backgroundColor: tokens.brass } }}
            >
              <Tab value="roster" label="From your roster" sx={{ textTransform: "none" }} />
              <Tab value="email" label="By email" sx={{ textTransform: "none" }} />
            </Tabs>

            {tab === "roster" ? (
              <Autocomplete<RosterPerson, false, false, false>
                options={roster}
                value={person}
                onChange={(_, next) => setPerson(next)}
                getOptionLabel={(o) => o.fullName}
                isOptionEqualToValue={(a, b) => a.profileId === b.profileId}
                forcePopupIcon
                renderInput={(params) => (
                  <TextField {...params} label="Member"
                    helperText="Approved members of this club" />
                )}
                noOptionsText="No approved members yet"
              />
            ) : (
              <TextField
                fullWidth
                name="email"
                type="email"
                label="Email address"
                autoComplete="off"
                helperText="They will get a link. It works whether or not they have an account."
              />
            )}

            <Stack spacing={1} sx={{ mt: 2.5 }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                What they will be able to do
              </Typography>
              <RolePicker name="rolePick" value={role} onChange={setRole} />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button variant="text" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton
              label="Send invitation"
              pendingLabel="Sending the invitation"
              size="medium"
              blocked={tab === "roster" && !person}
            />
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
