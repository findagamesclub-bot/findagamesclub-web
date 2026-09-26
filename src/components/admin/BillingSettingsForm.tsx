"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PaymentsIcon from "@mui/icons-material/Payments";
import ScheduleIcon from "@mui/icons-material/EventBusy";
import StarIcon from "@mui/icons-material/StarBorder";
import ReceiptIcon from "@mui/icons-material/ReceiptLong";
import Panel from "@/components/members/Panel";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import {
  saveBillingSettingsAction, type BillingState,
} from "@/app/admin/billing/actions";
import { tokens } from "@/lib/tokens";
import type { BillingSettingsRow } from "@/repositories/billing.repository";

/**
 * What a listing costs, and what happens when nobody pays.
 *
 * One form rather than four, unlike the site settings: these numbers are read
 * together, changed together and only make sense together. A grace period
 * saved without the reminder days that feed it is half a policy.
 *
 * Prices in pounds because that is what a price is. The database stores pence
 * and the action converts, so nothing downstream ever holds a float.
 *
 * Dispatched from `onSubmit` inside a transition rather than through the form's
 * `action` prop: React 19 resets an uncontrolled form once its action has run,
 * and eight settings wiped by a refusal is the trap the listing builder already
 * paid for. The two switches are controlled for the same reason, and because an
 * uncontrolled one whose `defaultChecked` changes underneath it keeps the
 * position somebody dragged it to while the server says the opposite.
 */
export default function BillingSettingsForm({
  settings,
}: {
  settings: BillingSettingsRow;
}) {
  const [state, submit, working] =
    useActionState<BillingState, FormData>(saveBillingSettingsAction, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [autoHide, setAutoHide] = useState(settings.auto_hide_lapsed);

  // Adjusted during render rather than in an effect, which is React's own
  // answer to "a prop changed": an effect would paint the old value first and
  // `react-hooks/set-state-in-effect` refuses it. It fires only when the server
  // itself changed, so a switch somebody has just dragged is left alone while
  // the save is in flight, and one changed by another admin catches up.
  const [seen, setSeen] = useState(
    { on: settings.enabled, hide: settings.auto_hide_lapsed });
  if (seen.on !== settings.enabled || seen.hide !== settings.auto_hide_lapsed) {
    setSeen({ on: settings.enabled, hide: settings.auto_hide_lapsed });
    setEnabled(settings.enabled);
    setAutoHide(settings.auto_hide_lapsed);
  }

  const pounds = (pence: number) => (pence / 100).toFixed(2);

  return (
    <Box component="form"
      onSubmit={(event) => {
        event.preventDefault();
        start(() => submit(new FormData(event.currentTarget)));
      }}>
      {/* Four panels rather than one long card. The tab above already says
          "What a listing costs", so a panel repeating it added nothing, and the
          switch that hides a club for not paying was buried in the middle of
          eight fields it has no relation to. Each panel is one question. */}
      <Stack spacing={2.5}>
        <Panel title="Charging" icon={PaymentsIcon}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <FormControlLabel
                control={<Switch name="enabled" checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)} />}
                label="Charge for listings"
              />
              <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                While this is off every listing is free, nothing is chased and
                approving a club asks no questions about money. Turning it on
                affects listings sent in from that moment, not the ones already up.
              </Typography>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField name="monthly" label="A month" fullWidth
                defaultValue={pounds(settings.monthly_price_pence)}
                helperText="In pounds. A month is 30 days, as it was before." />
              <TextField name="yearly" label="A year" fullWidth
                defaultValue={pounds(settings.yearly_price_pence)}
                helperText="In pounds. A year is 365 days." />
            </Stack>
          </Stack>
        </Panel>

        <Panel title="When a club falls behind" icon={ScheduleIcon}>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField name="reminders" label="Remind them" fullWidth
                defaultValue={settings.reminder_days.join(", ")}
                helperText="Days before it runs out to write. 14, 3 writes twice. Empty writes nothing." />
              <TextField name="grace" label="Grace period" type="number" fullWidth
                defaultValue={settings.grace_period_days}
                helperText="Days after it runs out before the listing counts as lapsed." />
            </Stack>

            <Stack spacing={0.5}>
              <FormControlLabel
                control={<Switch name="autoHide" checked={autoHide}
                  onChange={(event) => setAutoHide(event.target.checked)} />}
                label="Take a lapsed listing out of the directory"
              />
              <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                Off by default. With it off a lapsed club stays listed and the
                chasing is yours; with it on the club disappears the day grace runs
                out, is emailed to say so, and comes straight back when it pays.
                Its members keep everything either way.
              </Typography>
            </Stack>
          </Stack>
        </Panel>

        <Panel title="Featured slots" icon={StarIcon}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField name="featuredPrice" label="A featured slot" fullWidth
              defaultValue={pounds(settings.featured_price_pence)}
              helperText="In pounds, for one slot on the homepage." />
            <TextField name="featuredDays" label="Slot length" type="number" fullWidth
              defaultValue={settings.featured_duration_days}
              helperText="Days a slot runs for, when no end date is given." />
          </Stack>
        </Panel>

        <Panel title="How to pay" icon={ReceiptIcon}>
          <TextField name="instructions" label="How to pay" fullWidth
            multiline minRows={4}
            defaultValue={settings.payment_instructions_md}
            helperText="Shown to every club on its own billing page. Markdown: bank details, who to make a cheque out to, where to send it." />
        </Panel>

        <SubmitButton label="Save" pendingLabel="Saving the settings"
          variant="contained" pending={working} sx={{ alignSelf: "flex-start" }} />
      </Stack>
    </Box>
  );
}
