"use client";

import { useActionState, useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import StarIcon from "@mui/icons-material/StarBorder";
import Panel from "@/components/members/Panel";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { saveLoyaltyAction, type SettingsState } from "./actions";
import { MILESTONE_FIELDS } from "@/utils/loyalty";
import { tokens } from "@/lib/tokens";

/**
 * The points programme.
 *
 * Six fields, which is not a coincidence: they are exactly what legacy's sixth
 * readiness check asks for, so a club that fills this in is a club whose
 * listing stops saying it is unfinished.
 */
export default function LoyaltySettingsForm({
  slug, enabled: initialEnabled, pointValue, bookingPrice, milestones,
}: {
  slug: string;
  enabled: boolean;
  pointValue: string;
  bookingPrice: string;
  milestones: Record<string, number>;
}) {
  const [state, submit] = useActionState<SettingsState, FormData>(saveLoyaltyAction, {});
  useActionToast(state);
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="enabled" value={enabled ? "yes" : "no"} />

      <Stack spacing={2.5}>
        <Panel title="Points" icon={LoyaltyIcon}>
          <Stack spacing={2}>
            <FormControlLabel
              control={<Switch checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)} />}
              label={<Typography variant="body2">
                Collect points members can spend
              </Typography>} />

            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {enabled
                ? "Points are awarded automatically as members join, book and buy."
                : "While this is off, nothing is awarded and the loyalty page is hidden."}
            </Typography>

            {enabled ? (
              <NextLink href={`/clubs/${slug}/loyalty`} style={{ textDecoration: "none" }}>
                <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                  See what members have earned &rsaquo;
                </Typography>
              </NextLink>
            ) : null}

            <TextField name="pointValue" label="What one point is worth"
              defaultValue={pointValue} fullWidth inputMode="decimal"
              helperText="In pounds. 0.05 means twenty points takes a pound off." />

            {/* Legacy's `tableBookingPrice`, which is money and not points
                (club_store.py:48, default "GBP 5"). It is the price a table
                falls back to when the night has not set one, and it is carried
                so an imported club can still see and fix it. Nothing in this
                app reads it yet: see DEFERRED.md. */}
            <TextField name="bookingPrice" label="What a table costs"
              defaultValue={bookingPrice} fullWidth
              helperText="The fallback price for a table, in pounds, when a club night has not set its own." />
          </Stack>
        </Panel>

        <Panel title="What earns points" icon={StarIcon}>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Set any of these to zero and it earns nothing.
            </Typography>
            {MILESTONE_FIELDS.map((milestone) => (
              <TextField key={milestone.key} name={`milestone-${milestone.key}`}
                label={milestone.label}
                defaultValue={String(milestones[milestone.key] ?? 0)}
                fullWidth inputMode="numeric" />
            ))}
          </Stack>
        </Panel>
      </Stack>

      <Stack direction="row" sx={{ mt: 3, justifyContent: "flex-end" }}>
        <SubmitButton label="Save changes" pendingLabel="Saving" />
      </Stack>
    </Box>
  );
}
