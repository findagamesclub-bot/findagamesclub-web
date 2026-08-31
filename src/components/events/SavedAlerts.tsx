"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NotificationsIcon from "@mui/icons-material/NotificationsActiveOutlined";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useEventsBusy } from "./EventsBusy";
import { deleteAlertAction } from "@/app/events/actions";
import { tokens } from "@/lib/tokens";
import type { SavedAlert } from "@/services/eventAlerts.service";

/**
 * The searches this person has saved.
 *
 * Shown on the page the alert was made from rather than buried in account
 * settings: saving one and checking it saved are the same moment, and a chip
 * you can click straight back into is more useful than a list you can only
 * read.
 */
export default function SavedAlerts({ alerts }: { alerts: SavedAlert[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const { run } = useEventsBusy();
  const [failed, setFailed] = useState<string | null>(null);
  // Deleting an alert is not undoable — the search is gone and so is anything
  // it would have told you about.
  const [confirming, setConfirming] = useState<SavedAlert | null>(null);

  if (!alerts.length) return null;

  const apply = (alert: SavedAlert) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(alert.filters)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    // scroll: false, same as the filter bar — the results are below.
    run(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const remove = (alert: SavedAlert) => {
    setFailed(null);
    start(async () => {
      const result = await deleteAlertAction(alert.id);
      if (result.error) setFailed(result.error);
    });
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.25 }}>
        <NotificationsIcon sx={{ fontSize: 17, color: tokens.brass }} />
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                          letterSpacing: "0.12em", color: tokens.inkMuted, fontWeight: 700 }}>
          YOUR SAVED SEARCHES
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", opacity: pending ? 0.6 : 1 }}>
        {alerts.map((alert) => (
          <Chip
            key={alert.id}
            label={alert.label}
            onClick={() => apply(alert)}
            onDelete={() => setConfirming(alert)}
            disabled={pending}
            sx={{ height: 32, fontSize: "0.85rem",
                  backgroundColor: tokens.paper, border: `1px solid ${tokens.rule}`,
                  "&:hover": { borderColor: tokens.brass } }}
          />
        ))}
      </Stack>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Stop this alert?"
        body={
          <>
            <strong>{confirming?.label}</strong> will be deleted and you will stop
            hearing about new events that match it. The search still works, so you can
            set the same filters again and save it whenever you like.
          </>
        }
        confirmLabel="Delete alert"
        cancelLabel="Keep it"
        destructive
        busy={pending}
        onConfirm={() => { if (confirming) remove(confirming); }}
        onClose={() => setConfirming(null)}
      />

      {failed ? (
        <Typography variant="body2" sx={{ color: tokens.danger, mt: 1 }}>{failed}</Typography>
      ) : (
        <Typography variant="caption" sx={{ color: tokens.inkMuted, mt: 1, display: "block" }}>
          Click one to run it again, or the ✕ to stop the alert.
        </Typography>
      )}
    </Box>
  );
}
