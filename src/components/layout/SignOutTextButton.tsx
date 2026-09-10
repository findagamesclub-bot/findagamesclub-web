"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import SignOutConfirm from "./SignOutConfirm";

/**
 * Signing out from a line of text rather than a button.
 *
 * Its own file because both callers are server components and the
 * confirmation needs state.
 */
export default function SignOutTextButton({
  sx, label = "Sign out", title, confirmLabel, next,
}: {
  sx?: SxProps<Theme>;
  label?: string;
  title?: string;
  confirmLabel?: string;
  /** Where to land afterwards, instead of the directory. */
  next?: string;
}) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <Box component="button" type="button" onClick={() => setAsking(true)} sx={sx}>
        {label}
      </Box>
      <SignOutConfirm open={asking} onClose={() => setAsking(false)}
        title={title} confirmLabel={confirmLabel} next={next} />
    </>
  );
}
