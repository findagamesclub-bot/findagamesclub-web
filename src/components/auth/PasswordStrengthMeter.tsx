"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { BAND_LABELS, PASSWORD_HINT, strength } from "@/utils/password-strength";
import { mono, tokens } from "@/lib/tokens";

/**
 * How strong the password being typed is.
 *
 * Four segments rather than a single bar, because a bar that is 40% full does
 * not tell anybody what to do and four blocks filling up does. The label and
 * the one piece of advice underneath are the part that actually helps, and they
 * are announced politely so a screen reader hears the change without being
 * interrupted mid-word.
 *
 * Deliberately not a colour-only signal: the band is written out. Rule 1 of the
 * checklist in reverse, colour identifies but never carries the meaning on its
 * own.
 */
export default function PasswordStrengthMeter({
  password, email = "",
}: {
  password: string;
  email?: string;
}) {
  // Nothing typed yet is not "weak", it is nothing. Shouting at an empty field
  // before somebody starts is the meter being rude for no information.
  if (!password) {
    return (
      <Typography variant="caption" sx={{ color: tokens.inkMuted, display: "block", mt: -0.5 }}>
        {PASSWORD_HINT}
      </Typography>
    );
  }

  const result = strength(password, email);
  const tone = result.band === "weak" ? tokens.danger
    : result.band === "fair" ? tokens.brass
      : result.band === "good" ? tokens.brand
        : tokens.positive;

  return (
    <Stack spacing={0.75} sx={{ mt: -0.5 }}>
      <Stack direction="row" spacing={0.5} aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <Box key={segment}
            sx={{ height: 4, flex: 1, borderRadius: 2,
                  backgroundColor: segment <= result.score ? tone : tokens.rule,
                  transition: "background-color 150ms ease" }} />
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
        <Typography aria-live="polite"
          sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                letterSpacing: "0.1em", color: tone }}>
          {BAND_LABELS[result.band].toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ color: tokens.inkMuted, minWidth: 0 }}>
          {result.refusal ?? result.advice ?? PASSWORD_HINT}
        </Typography>
      </Stack>
    </Stack>
  );
}
