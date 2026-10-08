"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

export type PlanOffer = {
  current: "monthly" | "yearly";
  monthly: string;
  yearly: string;
};

/**
 * Monthly or yearly, the first time a club is ever asked.
 *
 * `club_submissions.plan_interval` decides the price the subscription opens at
 * (0112 reads it) and nothing could set it until 0161, so every listing became
 * monthly whatever the marketing page advertised.
 *
 * Deliberately quieter than the billing page's own picker: this sits above a
 * Send button on a step whose decision is "is my listing finished", and a pair
 * of priced cards there would compete with it. Same two words, less weight.
 */
export default function PlanChoice({
  offer, picked, onPick,
}: {
  offer: PlanOffer;
  picked: "monthly" | "yearly";
  onPick: (value: "monthly" | "yearly") => void;
}) {
  return (
    <Stack spacing={1} sx={{ mb: 2.5 }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        HOW YOU WOULD LIKE TO PAY
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}
        role="radiogroup" aria-label="How you would like to pay">
        {([["monthly", offer.monthly], ["yearly", offer.yearly]] as const).map(
          ([value, label]) => {
            const chosen = picked === value;
            return (
              <Box key={value} component="button" type="button" role="radio"
                aria-checked={chosen}
                onClick={() => onPick(value)}
                sx={{ flex: 1, textAlign: "left", cursor: "pointer",
                      py: 1.25, borderRadius: 1.5, backgroundColor: tokens.paper,
                      // The border thickens on selection and the padding gives
                      // the pixel back, so the row does not jump.
                      px: chosen ? "11px" : "12px",
                      border: `${chosen ? 2 : 1}px solid `
                        + `${chosen ? tokens.brand : tokens.rule}`,
                      transition: "border-color 140ms ease",
                      "&:hover": { borderColor: chosen ? tokens.brand : tokens.inkMuted },
                      "&:focus-visible": {
                        outline: `2px solid ${tokens.brand}`, outlineOffset: 2 } }}>
                <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
              </Box>
            );
          })}
      </Stack>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        You can change this later from your club&rsquo;s billing page.
      </Typography>
    </Stack>
  );
}
