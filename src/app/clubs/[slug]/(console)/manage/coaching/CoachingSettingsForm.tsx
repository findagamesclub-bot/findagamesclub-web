"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SchoolIcon from "@mui/icons-material/School";
import Panel from "@/components/members/Panel";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { saveCoachingAction, type SettingsState } from "./actions";
import { tokens } from "@/lib/tokens";

/**
 * Coaching, switched on or off, and the two bits of text around it.
 *
 * The switch is the whole point: until it is on, the club's coaching page tells
 * members there is nothing here, and the only way to change that used to be SQL.
 */
export default function CoachingSettingsForm({
  slug, enabled: initialEnabled, intro, policy,
}: {
  slug: string;
  enabled: boolean;
  intro: string;
  policy: string;
}) {
  const [state, submit] = useActionState<SettingsState, FormData>(saveCoachingAction, {});
  useActionToast(state);
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="enabled" value={enabled ? "yes" : "no"} />

      <Panel title="Coaching" icon={SchoolIcon}>
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)} />}
            label={<Typography variant="body2">
              Offer coaching sessions members can book
            </Typography>} />

          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {enabled
              ? "Members read this above and below your sessions on the club page."
              : "While this is off, the coaching page tells members you do not offer it."}
          </Typography>

          <TextField name="intro" label="What to say about it" defaultValue={intro}
            fullWidth multiline minRows={3}
            helperText="Shown above the sessions. Who coaches, what to bring, who it is for." />

          <TextField name="policy" label="Anything they should know first"
            defaultValue={policy} fullWidth multiline minRows={2}
            helperText="Cancellations, what it costs, how far ahead to book." />
        </Stack>
      </Panel>

      <Stack direction="row" sx={{ mt: 3, justifyContent: "flex-end" }}>
        <SubmitButton label="Save changes" pendingLabel="Saving" />
      </Stack>
    </Box>
  );
}
