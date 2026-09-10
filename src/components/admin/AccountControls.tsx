"use client";

import { useActionState, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { accountAction, type AdminState } from "@/app/admin/actions";

/**
 * Suspend, restore, hand out admin, send a reset.
 *
 * Suspending asks for a reason because the person it happens to can see it,
 * and "your account was suspended" with no reason is the message that generates
 * the support email. Making somebody an admin asks for their name to be typed:
 * it is the one action here that hands over the whole site.
 */
export default function AccountControls({
  profileId, name, email, active, isAdmin,
}: {
  profileId: string;
  name: string;
  email: string;
  active: boolean;
  isAdmin: boolean;
}) {
  const [suspending, setSuspending] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const promoteRef = useRef<HTMLFormElement>(null);
  /**
   * Which button is working.
   *
   * Four forms share one action, so `pending` is true for all of them at once
   * and every button spun on every click. The spinner has to say what is
   * happening, not that something is.
   */
  const [running, setRunning] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState<AdminState, FormData>(
    async (prev, data) => {
      setRunning(String(data.get("intent") ?? ""));
      try {
        const next = await accountAction(prev, data);
        if (next.notice) setSuspending(false);
        return next;
      } finally {
        setRunning(null);
      }
    },
    {},
  );
  useActionToast(state);

  const hidden = (intent: string, extra?: Record<string, string>) => (
    <>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="profileId" value={profileId} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );

  return (
    <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
      {active ? (
        <Button variant="outlined" color="error" onClick={() => setSuspending(true)}
          disabled={pending}>
          Suspend
        </Button>
      ) : (
        <Box component="form" action={formAction}>
          {hidden("restore")}
          <Button type="submit" variant="contained"
            loading={running === "restore"} loadingPosition="start"
            disabled={pending && running !== "restore"}>
            Restore
          </Button>
        </Box>
      )}

      <Box component="form" action={formAction}>
        {hidden("reset", { email })}
        <Button type="submit" variant="outlined"
          loading={running === "reset"} loadingPosition="start"
          disabled={pending && running !== "reset"}>
          Send a password reset
        </Button>
      </Box>

      {isAdmin ? (
        <Box component="form" action={formAction}>
          {hidden("role", { role: "member" })}
          <Button type="submit" variant="outlined"
            loading={running === "role"} loadingPosition="start"
            disabled={pending && running !== "role"}>
            Remove admin access
          </Button>
        </Box>
      ) : (
        <Button variant="outlined" onClick={() => setPromoting(true)} disabled={pending}>
          Make a site admin
        </Button>
      )}

      <Dialog open={suspending} onClose={() => setSuspending(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Suspend {name}?</DialogTitle>
        <Box component="form" action={formAction}>
          {hidden("suspend")}
          <DialogContent>
            <DialogContentText sx={{ fontSize: "0.95rem", mb: 2 }}>
              They are signed out and cannot sign in again. Anything they have
              written stays where it is, and clubs they own stay theirs.
            </DialogContentText>
            {/* A field that needs room takes the whole row. */}
            <TextField
              name="reason"
              label="Reason"
              fullWidth
              multiline
              minRows={2}
              required
              helperText="They can see this. Say what happened, not just that it did."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button variant="text" onClick={() => setSuspending(false)}>Cancel</Button>
            <SubmitButton label="Suspend the account" pendingLabel="Suspending"
              size="medium" color="error" />
          </DialogActions>
        </Box>
      </Dialog>

      <TypedConfirmDialog
        open={promoting}
        title="Make a site admin?"
        body={`${name} will be able to open every club's console, suspend accounts and change anything on the site.`}
        phrase={name}
        confirmLabel="Make them an admin"
        busy={running === "role"}
        // Left open on purpose: the dialog shuts itself when the work lands,
        // which is what makes its spinner reachable.
        onConfirm={() => promoteRef.current?.requestSubmit()}
        onClose={() => setPromoting(false)}
      />

      <Box component="form" ref={promoteRef} action={formAction} sx={{ display: "none" }}>
        {hidden("role", { role: "admin" })}
      </Box>
    </Stack>
  );
}
