"use client";

import { useFormStatus } from "react-dom";
import Button, { type ButtonProps } from "@mui/material/Button";

type Props = Omit<ButtonProps, "type" | "disabled"> & {
  label: string;
  /**
   * Present tense, e.g. "Signing in". Announced to screen readers while the
   * form is submitting; never shown on screen.
   */
  pendingLabel: string;
  /** Set when the form knows it isn't ready — e.g. two passwords disagree. */
  blocked?: boolean;
};

/**
 * Submit button that shows its own progress.
 *
 * useFormStatus reads the enclosing form, so the button tracks pending state
 * itself rather than having it threaded down.
 *
 * The visible label does NOT change while submitting — a button that rewrites
 * itself to "Sending…" reads as filler. MUI swaps in a spinner and holds the
 * width, and the present-tense wording goes to assistive tech instead.
 */
export default function SubmitButton({ label, pendingLabel, blocked = false, ...props }: Props) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="contained"
      size="large"
      loading={pending}
      loadingPosition="start"
      disabled={blocked}
      aria-label={pending ? pendingLabel : undefined}
      {...props}
      sx={{ "&.Mui-disabled": { color: "#FFFFFF", opacity: 0.9 }, ...props.sx }}
    >
      {label}
    </Button>
  );
}
