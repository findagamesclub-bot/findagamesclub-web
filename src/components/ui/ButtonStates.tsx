"use client";

import { useActionState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SubmitButton from "./SubmitButton";
import { slowAction } from "@/app/dev/form-preview/slow-actions";
import { mono, tokens } from "@/lib/tokens";

/**
 * Every shape of submit button, holding still long enough to read.
 *
 * Press one and it works for a second and a half. What to look for: the label
 * stays put rather than being rewritten, the spinner replaces the start icon,
 * and the label is legible against whatever the button is sitting on. That last
 * one has now been wrong twice, black on black and then white on white, both
 * from setting a colour without asking what was behind it.
 */
function One({ label, variant, blocked = false }: {
  label: string;
  variant: "contained" | "outlined" | "text";
  blocked?: boolean;
}) {
  const [, submit, pending] = useActionState(slowAction, { notice: "" });

  return (
    <Stack spacing={0.75} sx={{ alignItems: "flex-start" }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.08em", color: tokens.inkMuted }}>
        {`${variant.toUpperCase()}${blocked ? " · BLOCKED" : ""}`}
      </Typography>
      <Box component="form" action={submit}>
        <SubmitButton label={label} pendingLabel="Working" variant={variant}
          blocked={blocked} pending={pending} />
      </Box>
    </Stack>
  );
}

export default function ButtonStates() {
  return (
    <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: "wrap" }}>
      <One label="Save changes" variant="contained" />
      <One label="List a different club" variant="outlined" />
      <One label="Save and finish later" variant="text" />
      <One label="Send it to us" variant="contained" blocked />
    </Stack>
  );
}
