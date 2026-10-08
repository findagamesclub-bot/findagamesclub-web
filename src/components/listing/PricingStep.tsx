"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
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
import TierCard, { type TierDraft } from "./TierCard";
import StepTargetFields, { type StepTarget } from "./StepTarget";
import StepFooter from "./StepFooter";
import { useActionToast } from "@/components/ui/Toaster";
import { saveListingStepAction, type ListingState } from
  "@/app/clubs/[slug]/(console)/manage/listing/[step]/actions";
import { optionRows } from "@/utils/billing-options";
import { tokens } from "@/lib/tokens";

export type PricingModelRow = { label: string; price: string; notes: string };

/** A tier as the read path hands it over, with its options still as json. */
export type TierRow = {
  key: string;
  label: string;
  price: string;
  duration: string;
  description: string;
  isBasic: boolean;
  held: number;
  benefits: string;
  billing: string;
};

/** Broken json must not wipe a club's prices, so it reads as none. */
const parse = (raw: string): unknown => {
  try { return JSON.parse(raw); } catch { return []; }
};

/**
 * Step 3: drop-in prices, membership tiers, and whether points are collected.
 *
 * A tier's key is its identity everywhere else in the app, so renaming one is
 * safe and removing one is not. Each row says how many members hold it, and
 * the remove button is gone when anybody does, rather than letting somebody
 * find that out from an error.
 *
 * A tier's price is no longer a box on this screen. It is the first of its
 * payment options, which is legacy's own rule and the only shape where the
 * price on the club page and the prices a member can be charged cannot
 * disagree. The incoming headline seeds the first option for a club that has
 * only ever had one price.
 */
export default function PricingStep({
  target, models: initialModels, tiers: initialTiers, loyaltyEnabled,
}: {
  target: StepTarget;
  models: PricingModelRow[];
  tiers: TierRow[];
  loyaltyEnabled: boolean;
}) {
  const [state, submit, saving] = useActionState<ListingState, FormData>(saveListingStepAction, {});
  useActionToast(state);

  /**
   * Submitted by hand rather than through the form's `action` prop.
   *
   * React 19 resets an uncontrolled form once its action has run. That is right
   * when the save worked and catastrophic when it did not: a refused save
   * emptied all thirteen fields and then said "some of that needs another look"
   * about work that was no longer on screen. Dispatching the action ourselves
   * keeps everything typed exactly where it was.
   *
   * The button is told it is busy for the same reason: `useFormStatus` only
   * reports on a form that submits through `action`.
   */
  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };
  const [models, setModels] = useState(initialModels);
  const [tiers, setTiers] = useState<TierDraft[]>(() => initialTiers.map((t) => ({
    key: t.key, label: t.label, description: t.description, isBasic: t.isBasic,
    held: t.held, benefits: t.benefits,
    options: optionRows(parse(t.billing), t.price, t.duration),
  })));
  const [basic, setBasic] = useState(initialTiers.find((t) => t.isBasic)?.key ?? "");
  const [loyalty, setLoyalty] = useState(loyaltyEnabled);

  const setModel = (index: number, patch: Partial<PricingModelRow>) =>
    setModels((held) => held.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  const setTier = (index: number, patch: Partial<TierDraft>) =>
    setTiers((held) => held.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <Box component="form" onSubmit={send}>
      <StepTargetFields target={target} step="pricing" />

      <Stack spacing={2.5}>
        <Panel title="Coming for the evening" icon={PaymentsIcon}>
          <Stack spacing={1.5}>
            {/* The currency is said once, in words, rather than stamped on the
                field. A hard "£" in the box is wrong here: this field takes a
                word as readily as a number, and somebody typing Free got
                "£Free". Prices are pounds because every club in the directory
                is UK-based, and a bare figure renders as "£4" on the club page,
                which nothing on the form used to say. */}
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              What somebody pays who is not a member, in pounds. Type a figure
              like 4, or a word like Free. Leave it empty if you do not charge.
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
              One of these is the tier people land on by joining. Each can be
              sold more than one way, so a monthly, a yearly and a one-off price
              all live on the same tier. Renaming a tier is safe; a tier
              somebody holds cannot be removed.
            </Typography>

            <RadioGroup value={basic} onChange={(e) => setBasic(e.target.value)}>
              {tiers.map((tier, index) => (
                <TierCard key={tier.key} tier={tier} basic={basic}
                  onChange={(patch) => setTier(index, patch)}
                  onRemove={() => setTiers((held) => held.filter((_, i) => i !== index))} />
              ))}
            </RadioGroup>

            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => setTiers((held) => [...held, {
                key: `tier-${crypto.randomUUID().slice(0, 8)}`,
                label: "", description: "", isBasic: false, held: 0,
                benefits: "{}", options: [],
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

      <StepFooter target={target} pending={saving} />
    </Box>
  );
}
