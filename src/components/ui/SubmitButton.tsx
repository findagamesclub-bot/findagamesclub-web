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
  /**
   * Told rather than read from the form.
   *
   * `useFormStatus` only reports on a form that submits through its `action`
   * prop. A form that dispatches its own action, to stop React 19 wiping every
   * field on a refused save, has to hand the pending flag down instead.
   */
  pending?: boolean;
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
export default function SubmitButton({
  label, pendingLabel, blocked = false, pending: told, ...props
}: Props) {
  const status = useFormStatus();
  const pending = told ?? status.pending;

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
        // MUI disables the button while it loads, and the default disabled grey
        // on a dark contained button is unreadable, so a PENDING one keeps its
        // white label.
        //
        // Only a contained one. On an outlined or text button the ground is the
        // page, and forcing the label white turned "List a different club" into
        // an empty outline with an invisible spinner in it. This is rule 4 of
        // the checklist arriving from the other side: the first time it was
        // black on black, this time white on white, and both come from styling
        // a colour without asking what it is sitting on.
        //
        // A BLOCKED button gets none of this: it is genuinely off, and a control
        // that looks live and does nothing when pressed is worse than one that
        // looks off.
        ...(pending && (props.variant ?? "contained") === "contained"
          ? { "&.Mui-disabled": { color: "#FFFFFF", opacity: 0.9 } }
          // An outlined or text button keeps its own colour instead. MUI's
          // disabled grey is rgba(0,0,0,0.26), about 1.9:1 on the page, and a
          // button that is working is not disabled: the person who pressed it
          // has to be able to read what they pressed.
          : pending
            ? { "&.Mui-disabled": { color: "primary.main", borderColor: "primary.main",
                                    opacity: 0.75 } }
            : {}),
        ...props.sx,
      }}
    >
      {label}
    </Button>
  );
}
