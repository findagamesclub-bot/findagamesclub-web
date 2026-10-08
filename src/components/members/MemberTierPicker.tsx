"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * Which tier a member is on.
 *
 * Controlled, which is the whole point. It used to be a `defaultValue`, so the
 * box could say "Life Member · £120" while the payment form underneath went on
 * offering the tier they were actually on. The client screenshotted exactly
 * that and called it not aligned, and it was: two controls describing one
 * membership, one of them showing a change that had not happened.
 *
 * The picked tier is lifted so the payment form can say out loud which tier it
 * is recording against, rather than the two quietly meaning different things.
 */
export default function MemberTierPicker({
  membershipId, slug, tiers, saved, picked, busy, onPick, send,
}: {
  membershipId: number;
  slug: string;
  tiers: MembershipTier[];
  /** The tier the member actually holds. */
  saved: string | null;
  picked: string;
  busy: boolean;
  onPick: (key: string) => void;
  send: (data: FormData) => void;
}) {
  const moved = picked !== (saved ?? "");
  const chosen = tiers.find((t) => t.key === picked);

  return (
    <Box component="form" action={send}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="slug" value={slug} />
      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
        MEMBERSHIP TIER
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField select name="tierKey" size="small" label="Tier" fullWidth
          value={picked} onChange={(event) => onPick(event.target.value)}>
          {tiers.map((t) => (
            <MenuItem key={t.key} value={t.key}>
              {t.label}{t.price ? ` · ${t.price}` : ""}
            </MenuItem>
          ))}
        </TextField>
        {/* One spinner marks one action. `busy` is shared with the "Move
            them" button on a tier request above, and without `moved` this one
            would spin for work nobody started here. */}
        <Button type="submit" variant="outlined" loading={busy && moved}
          loadingPosition="start" disabled={!moved} sx={{ flexShrink: 0 }}>
          Save
        </Button>
      </Stack>

      {/* Said plainly rather than left to be inferred from a button that
          happens to be enabled. The payment form below names its own tier for
          the same reason. */}
      {moved ? (
        <Typography variant="body2" sx={{ color: tokens.brass, mt: 1 }}>
          {`Not saved yet. Press Save to move them to ${chosen?.label ?? "that tier"}.`}
        </Typography>
      ) : null}
    </Box>
  );
}
