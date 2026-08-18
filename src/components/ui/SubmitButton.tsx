"use client";

import { useFormStatus } from "react-dom";
import Box from "@mui/material/Box";
import Button, { type ButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

type Props = Omit<ButtonProps, "type" | "disabled"> & {
  label: string;
  /** Present tense, e.g. "Signing in". An ellipsis is appended. */
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
 * Both labels are stacked in a single grid cell: the hidden one holds the
 * width so the button never resizes mid-click, and because they overlap rather
 * than sit side by side, the visible label stays centred.
 */
export default function SubmitButton({ label, pendingLabel, blocked = false, ...props }: Props) {
  const { pending } = useFormStatus();
  const busyText = `${pendingLabel}…`;

  return (
    <Button
      type="submit"
      variant="contained"
      size="large"
      disabled={pending || blocked}
      aria-busy={pending}
      {...props}
      sx={{ "&.Mui-disabled": { color: "#FFFFFF", opacity: 0.9 }, ...props.sx }}
    >
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          "& > *": { gridArea: "1 / 1" },
        }}
      >
        <Box component="span" aria-hidden sx={{ visibility: "hidden", whiteSpace: "nowrap" }}>
          {label.length >= busyText.length ? label : busyText}
        </Box>

        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", gap: 1, whiteSpace: "nowrap" }}
        >
          {pending ? <CircularProgress size={16} thickness={5} sx={{ color: "inherit" }} aria-hidden /> : null}
          {pending ? busyText : label}
        </Box>
      </Box>
    </Button>
  );
}
