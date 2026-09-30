"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/LockOutlined";
import { useActionToast } from "@/components/ui/Toaster";
import { saveSettingAction, type SettingsState } from
  "@/app/account/notifications/actions";
import type { FamilySetting } from "@/services/notificationPrefs.service";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * Six switches, not forty-five.
 *
 * There are forty-five notification kinds. A switch each is a screen nobody
 * finishes, so each card governs a family and says how many kinds that is, so
 * the reader can see the switch is doing real work.
 *
 * Only email has a switch. The bell is the record of what happened and turning
 * it off would leave somebody with no way to find out what they missed, so the
 * page says that once at the top rather than offering a switch that does
 * nothing.
 */
export default function NotificationSettings({ settings }: { settings: FamilySetting[] }) {
  return (
    <Box sx={{
      display: "grid", gap: 2,
      gridTemplateColumns: {
        xs: "minmax(0, 1fr)",
        sm: "repeat(2, minmax(0, 1fr))",
        lg: "repeat(3, minmax(0, 1fr))",
      },
    }}>
      {settings.map((setting) => (
        <SettingCard key={setting.family} setting={setting} />
      ))}
    </Box>
  );
}

function SettingCard({ setting }: { setting: FamilySetting }) {
  const [state, submit] = useActionState<SettingsState, FormData>(
    saveSettingAction, {});
  useActionToast(state);

  // Held here so the switch moves under the finger rather than after the round
  // trip. The server is still the authority: a refused save toasts and the
  // next render puts it back.
  const [on, setOn] = useState(setting.email);
  const [pending, start] = useTransition();

  const change = (next: boolean) => {
    setOn(next);
    const data = new FormData();
    data.set("family", setting.family);
    data.set("bell", "on");
    if (next) data.set("email", "on");
    start(() => submit(data));
  };

  return (
    <Box
      component="section"
      sx={{
        height: "100%", display: "flex", flexDirection: "column",
        border: `1px solid ${tokens.rule}`, borderRadius: 1,
        backgroundColor: tokens.paper, p: 2.5,
        opacity: pending ? 0.75 : 1, transition: "opacity 150ms",
      }}
    >
      <Typography component="h2" sx={{
        fontFamily: display, fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.3,
      }}>
        {setting.label}
      </Typography>

      <Typography sx={{
        mt: 1, fontSize: "0.9rem", lineHeight: 1.55, color: tokens.inkMuted,
      }}>
        {setting.detail}
      </Typography>

      <Box sx={{ flex: 1 }} />

      <Typography sx={{
        mt: 2, fontFamily: mono, fontSize: "0.68rem", letterSpacing: "0.08em",
        textTransform: "uppercase", color: tokens.inkMuted,
      }}>
        {setting.covers} {setting.covers === 1 ? "notification" : "notifications"}
      </Typography>

      <Box sx={{
        mt: 1.5, pt: 1.5, borderTop: `1px solid ${tokens.rule}`,
      }}>
        {setting.locked ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <LockIcon aria-hidden sx={{ fontSize: 18, color: tokens.brass, mt: "1px" }} />
            <Typography sx={{ fontSize: "0.82rem", lineHeight: 1.5, color: tokens.inkMuted }}>
              {setting.locked}
            </Typography>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography component="label" htmlFor={`email-${setting.family}`}
              sx={{ fontFamily: display, fontWeight: 600, fontSize: "0.92rem" }}>
              Email me about this
            </Typography>
            <Switch
              id={`email-${setting.family}`}
              checked={on}
              disabled={pending}
              onChange={(event) => change(event.target.checked)}
              slotProps={{
                input: { "aria-label": `Email me about ${setting.label.toLowerCase()}` },
              }}
            />
          </Stack>
        )}
      </Box>
    </Box>
  );
}
