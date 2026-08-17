"use client";

import { useFormStatus } from "react-dom";
import Box from "@mui/material/Box";
import Button, { type ButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

type Props = Omit<ButtonProps, "type" | "disabled"> & {
  label: string;
  /** Present tense, e.g. "Signing in". An ellipsis is appended. */
  pendingLabel: string;
};

/**
 * Submit button that shows its own progress.
 *
 * useFormStatus reads the enclosing form, so the button tracks pending state
 * itself instead of having it threaded down. The wider of the two labels is
 * rendered invisibly to hold the width, otherwise the button resizes mid-click.
 */
export default function SubmitButton({ label, pendingLabel, ...props }: Props) {
  const { pending } = useFormStatus();
  const busyText = `${pendingLabel}…`;

  return (
    <Button
      type="submit"
      variant="contained"
      size="large"
      disabled={pending}
      aria-busy={pending}
      {...props}
      sx={{ position: "relative", "&.Mui-disabled": { color: "#FFFFFF", opacity: 0.9 }, ...props.sx }}
    >
      <Box component="span" sx={{ visibility: "hidden", display: "block", height: 0, overflow: "hidden" }}>
        {label.length >= busyText.length ? label : busyText}
      </Box>

      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        {pending ? <CircularProgress size={16} thickness={5} sx={{ color: "inherit" }} aria-hidden /> : null}
        {pending ? busyText : label}
      </Box>
    </Button>
  );
}
