"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import PaymentsIcon from "@mui/icons-material/Payments";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import Panel from "@/components/members/Panel";
import RemoveRow from "@/components/ui/RemoveRow";
import TierPerks from "./TierPerks";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { saveListingStepAction, type ListingState } from
  "@/app/clubs/[slug]/(console)/manage/listing/[step]/actions";
import { mono, tokens } from "@/lib/tokens";

export type PricingModelRow = { label: string; price: string; notes: string };

export type TierRow = {
  key: string;
  label: string;
  price: string;
  duration: string;
  description: string;
  isBasic: boolean;
  /** Members holding this tier. One with any cannot be removed. */
  held: number;
  /** Carried through untouched: this screen does not edit them yet. */
  benefits: string;
  billing: string;
};

/**
 * Step 3: drop-in prices, membership tiers, and whether points are collected.
 *
 * A tier's key is its identity everywhere else in the app, so renaming one is
 * safe and removing one is not. Each row says how many members hold it, and
 * the remove button is gone when anybody does, rather than letting somebody
 * find that out from an error.
 */
export default function PricingStep({
  slug, models: initialModels, tiers: initialTiers, loyaltyEnabled,
}: {
  slug: string;
  models: PricingModelRow[];
  tiers: TierRow[];
  loyaltyEnabled: boolean;
}) {
  const [state, submit] = useActionState<ListingState, FormData>(saveListingStepAction, {});
  useActionToast(state);
  const [models, setModels] = useState(initialModels);
  const [tiers, setTiers] = useState(initialTiers);
  const [basic, setBasic] = useState(initialTiers.find((t) => t.isBasic)?.key ?? "");
  const [loyalty, setLoyalty] = useState(loyaltyEnabled);

  const setModel = (index: number, patch: Partial<PricingModelRow>) =>
    setModels((held) => held.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  const setTier = (index: number, patch: Partial<TierRow>) =>
    setTiers((held) => held.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="step" value="pricing" />

      <Stack spacing={2.5}>
        <Panel title="Coming for the evening" icon={PaymentsIcon}>
          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              What somebody pays who is not a member. Leave it empty if you do
              not charge.
            </Typography>

            {models.map((model, index) => (
              <Box key={index} sx={{ display: "grid", gap: 1.5, alignItems: "start",
                     gridTemplateColumns: {
                       xs: "minmax(0, 1fr)",
                       sm: "minmax(0, 1.2fr) minmax(0, 0.6fr) minmax(0, 1.4fr) auto" } }}>
                <TextField size="small" label="What it is" name="modelLabel" value={model.label}
                  onChange={(e) => setModel(index, { label: e.target.value })} />
                <TextField size="small" label="Price" name="modelPrice" value={model.price}
                  onChange={(e) => setModel(index, { price: e.target.value })} />
                <TextField size="small" label="Anything to add" name="modelNotes"
                  value={model.notes}
                  onChange={(e) => setModel(index, { notes: e.target.value })} />
                <RemoveRow what="price"
                  confirm={Boolean(model.label || model.price || model.notes)}
                  body={<>
                    {model.label ? `"${model.label}"` : "This price"} comes off your
                    club page. Nothing changes until you save.
                  </>}
                  onRemove={() => setModels((held) => held.filter((_, i) => i !== index))} />
              </Box>
            ))}

            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => setModels((held) => [...held, { label: "", price: "", notes: "" }])}>
              Add a price
            </Button>
          </Stack>
        </Panel>

        <Panel title="Membership tiers" icon={CardMembershipIcon}>
          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              One of these is the tier people land on by joining. Renaming a tier
              is safe; a tier somebody holds cannot be removed.
            </Typography>

            <RadioGroup value={basic} onChange={(e) => setBasic(e.target.value)}>
              {tiers.map((tier, index) => (
                <Stack key={tier.key} spacing={1}
                  sx={{ p: 1.5, mb: 1, borderRadius: 1.5,
                        border: `1px solid ${basic === tier.key ? tokens.brass : tokens.rule}`,
                        backgroundColor: tokens.paper }}>
                  <input type="hidden" name="tierKey" value={tier.key} />
                  <input type="hidden" name="tierBilling" value={tier.billing} />
                  <input type="hidden" name="tierBasic" value={basic === tier.key ? "yes" : "no"} />

                  <Box sx={{ display: "grid", gap: 1.5, alignItems: "start",
                         gridTemplateColumns: {
                           xs: "minmax(0, 1fr)",
                           sm: "minmax(0, 1.4fr) minmax(0, 0.6fr) minmax(0, 0.8fr) auto" } }}>
                    <TextField size="small" label="Name" name="tierLabel" value={tier.label}
                      onChange={(e) => setTier(index, { label: e.target.value })} />
                    <TextField size="small" label="Price" name="tierPrice" value={tier.price}
                      onChange={(e) => setTier(index, { price: e.target.value })} />
                    <TextField size="small" label="Per" name="tierDuration" value={tier.duration}
                      onChange={(e) => setTier(index, { duration: e.target.value })}
                      placeholder="month" />
                    <RemoveRow what="tier" disabled={tier.held > 0}
                      confirm={Boolean(tier.label || tier.price || tier.duration
                                       || tier.description)}
                      body={<>
                        {tier.label ? `"${tier.label}"` : "This tier"} comes off your
                        club page, and the perks set on it go with it. Nothing changes
                        until you save.
                      </>}
                      onRemove={() => setTiers((held) => held.filter((_, i) => i !== index))} />
                  </Box>

                  <TextField size="small" fullWidth label="What it includes"
                    name="tierDescription" value={tier.description} multiline
                    onChange={(e) => setTier(index, { description: e.target.value })} />

                  <TierPerks name="tierBenefits" value={tier.benefits}
                    onChange={(benefits) => setTier(index, { benefits })} />

                  <Stack direction="row" spacing={2}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <FormControlLabel value={tier.key} control={<Radio size="small" />}
                      label={<Typography variant="body2">People join on this one</Typography>} />
                    {tier.held > 0 ? (
                      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                        color: tokens.brass }}>
                        {tier.held} MEMBER{tier.held === 1 ? "" : "S"} HOLD THIS
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              ))}
            </RadioGroup>

            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => setTiers((held) => [...held, {
                key: `tier-${crypto.randomUUID().slice(0, 8)}`,
                label: "", price: "", duration: "", description: "",
                isBasic: false, held: 0, benefits: "{}", billing: "[]",
              }])}>
              Add a tier
            </Button>
          </Stack>
        </Panel>

        <Panel title="Loyalty points" icon={LoyaltyIcon}>
          <input type="hidden" name="loyaltyEnabled" value={loyalty ? "yes" : "no"} />
          <Stack spacing={1}>
            <FormControlLabel
              control={<Switch checked={loyalty}
                onChange={(e) => setLoyalty(e.target.checked)} />}
              label={<Typography variant="body2">
                Collect points for turning up, booking and buying
              </Typography>} />
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              What each thing earns is set on the Loyalty page in the console.
            </Typography>
          </Stack>
        </Panel>
      </Stack>

      <Stack direction="row" spacing={2}
        sx={{ mt: 3, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Saving publishes straight away. Members see this on your club page.
        </Typography>
        <SubmitButton label="Save changes" pendingLabel="Saving" />
      </Stack>
    </Box>
  );
}
