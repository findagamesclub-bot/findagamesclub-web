"use client";

import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RemoveRow from "@/components/ui/RemoveRow";
import TierBilling from "./TierBilling";
import TierPerks from "./TierPerks";
import { normaliseOptions, type OptionRow } from "@/utils/billing-options";
import { mono, tokens } from "@/lib/tokens";

export type TierDraft = {
  key: string;
  label: string;
  description: string;
  isBasic: boolean;
  /** Members holding this tier. One with any cannot be removed. */
  held: number;
  /** Carried through untouched: this screen does not edit the perks' json. */
  benefits: string;
  /** The ways it can be paid for, which the owner does edit. */
  options: OptionRow[];
};

/**
 * One membership tier in the builder.
 *
 * Its own file because the step outgrew the size rule once the payment options
 * moved into it, and because a tier is the one thing on that page with four
 * parts to it rather than a row of boxes.
 *
 * No Price or Per field: the tier's headline comes from the first payment
 * option, which is legacy's rule and the only way the two cannot disagree.
 */
export default function TierCard({
  tier, basic, onChange, onRemove,
}: {
  tier: TierDraft;
  /** The key of the tier people join on, so this one knows if it is selected. */
  basic: string;
  onChange: (patch: Partial<TierDraft>) => void;
  onRemove: () => void;
}) {
  const selected = basic === tier.key;

  return (
    <Stack spacing={1.25}
      sx={{ p: 1.75, mb: 1.25, borderRadius: 1.5,
            border: `1px solid ${selected ? tokens.brass : tokens.rule}`,
            backgroundColor: tokens.paper }}>
      <input type="hidden" name="tierKey" value={tier.key} />
      <input type="hidden" name="tierBasic" value={selected ? "yes" : "no"} />
      {/* The options are the whole of what this tier costs, so the price and
          the cadence are not posted at all. A hidden headline riding along
          would resurrect a price the owner had just deleted. */}
      <input type="hidden" name="tierBilling"
        value={JSON.stringify(normaliseOptions(tier.options, tier.key))} />

      <Box sx={{ display: "grid", gap: 1.5, alignItems: "start",
             gridTemplateColumns: {
               xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" } }}>
        <TextField size="small" label="Name" name="tierLabel" value={tier.label}
          onChange={(e) => onChange({ label: e.target.value })} />
        <RemoveRow what="tier" disabled={tier.held > 0}
          confirm={Boolean(tier.label || tier.description || tier.options.length)}
          body={<>
            {tier.label ? `"${tier.label}"` : "This tier"} comes off your club
            page, and the perks and prices set on it go with it. Nothing changes
            until you save.
          </>}
          onRemove={onRemove} />
      </Box>

      <TextField size="small" fullWidth label="What it includes"
        name="tierDescription" value={tier.description} multiline
        onChange={(e) => onChange({ description: e.target.value })} />

      <TierBilling rows={tier.options}
        onChange={(options) => onChange({ options })} />

      <TierPerks name="tierBenefits" value={tier.benefits}
        onChange={(benefits) => onChange({ benefits })} />

      <Stack direction="row" spacing={2}
        sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <FormControlLabel value={tier.key} control={<Radio size="small" />}
          label={<Typography variant="body2">People join on this one</Typography>} />
        {tier.held > 0 ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                            color: tokens.brass }}>
            {`${tier.held} MEMBER${tier.held === 1 ? "" : "S"} HOLD THIS`}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}
