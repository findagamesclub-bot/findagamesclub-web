"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * Ask before signing somebody out.
 *
 * Sign out sits next to ordinary navigation in four places, and in the admin
 * console it is directly under the last section of the rail. One stray click
 * ends the session and there is no undo, only typing a password again.
 *
 * The form is here rather than around each trigger because two of those
 * triggers live inside a menu or a drawer that unmounts as soon as it closes,
 * which would take the dialog with it.
 */
export default function SignOutConfirm({
  open, onClose, title = "Sign out?", confirmLabel = "Sign out", next,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  confirmLabel?: string;
  /** Where to land afterwards, instead of the directory. */
  next?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [going, setGoing] = useState(false);

  return (
    <>
      <Box component="form" ref={form} action="/auth/sign-out" method="post" hidden>
        {next ? <input type="hidden" name="next" value={next} /> : null}
      </Box>
      <ConfirmDialog
        open={open}
        title={title}
        body="You will need your email and password to get back in."
        confirmLabel={confirmLabel}
        cancelLabel="Stay signed in"
        // Never resolves: the answer to this POST is a new page. It keeps the
        // spinner up for the round trip rather than leaving a dead dialog on
        // screen while the browser works.
        busy={going}
        onConfirm={() => { setGoing(true); form.current?.requestSubmit(); }}
        onClose={onClose}
      />
    </>
  );
}
