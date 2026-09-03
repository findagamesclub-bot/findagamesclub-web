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
      sx={{
        // MUI disables the button while it loads, and the default disabled
        // grey on a contained button is unreadable, so a PENDING button keeps
        // its white label. A BLOCKED one must not: it is genuinely off, and a
        // control that looks live and does nothing when pressed is worse than
        // one that looks off. That gets MUI's own disabled treatment.
        ...(pending ? { "&.Mui-disabled": { color: "#FFFFFF", opacity: 0.9 } } : {}),
        ...props.sx,
      }}
    >
      {label}
    </Button>
  );
}
