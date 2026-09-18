"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import Panel from "@/components/members/Panel";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { saveSettingAction, type SettingsState } from "@/app/admin/settings/actions";
import { tokens } from "@/lib/tokens";

/**
 * One site setting, with its own Save.
 *
 * Four separate forms rather than one big one, because these four things change
 * on completely different days: the contact address gets fixed in ten seconds,
 * the terms arrive from a solicitor months later. One Save for all four means
 * an admin correcting a typo in an email address is also republishing a legal
 * document, and has to think about whether that is safe.
 *
 * The result is a toast, not a line under the box, which is the rule everywhere
 * else in this app.
 */
export default function SettingField({
  field, title, icon, label, help, value, multiline = false,
}: {
  field: "contact" | "terms" | "privacy" | "cookies";
  title: string;
  icon?: SvgIconComponent;
  label: string;
  /** Long guidance goes here, never into the label, where MUI clips it. */
  help: string;
  value: string;
  multiline?: boolean;
}) {
  const [state, submit] = useActionState<SettingsState, FormData>(saveSettingAction, {});
  useActionToast(state);

  // Held in state so the button can tell whether anything has actually changed.
  // Saving an unchanged legal page and being told "it is live now" is the
  // screen reporting work it did not do.
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;

  return (
    <Panel title={title} icon={icon}>
      <Box component="form" action={submit}>
        <input type="hidden" name="field" value={field} />

        <Stack spacing={1.5}>
          <TextField
            name="value"
            label={label}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            fullWidth
            multiline={multiline}
            minRows={multiline ? 10 : undefined}
            helperText={help}
            slotProps={multiline
              ? { htmlInput: { style: { fontFamily: "var(--font-mono)", fontSize: "0.85rem" } } }
              : undefined}
          />

          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
            <SubmitButton
              label="Save"
              pendingLabel="Saving"
              variant="contained"
              blocked={!dirty}
              sx={{ alignSelf: "flex-start" }}
            />
            {dirty ? (
              <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                Not saved yet.
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Panel>
  );
}
