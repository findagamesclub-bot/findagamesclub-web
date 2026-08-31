"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteAlertAction } from "@/app/events/actions";
import { mono, tokens } from "@/lib/tokens";
import type { SavedAlert } from "@/services/eventAlerts.service";

const FILTER_LABELS: Record<string, string> = {
  q: "Search", city: "Near", type: "Type", format: "Format",
  game: "Game", when: "When", facility: "Facility",
};

/**
 * Saved searches, with the filters spelled out.
 *
 * On the events page an alert is a chip you click to re-run. Here it is the
 * record of what you asked to be told about, so the filters are written out
 * rather than hidden behind a label somebody typed weeks ago.
 */
export default function AlertList({ alerts }: { alerts: SavedAlert[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SavedAlert | null>(null);

  const hrefFor = (alert: SavedAlert) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(alert.filters)) {
      if (value) query.set(key, value);
    }
    return `/events?${query}`;
  };

  const remove = (alert: SavedAlert) => {
    setConfirming(null);
    start(async () => {
      const result = await deleteAlertAction(alert.id);
      if (result.error) setFailed(result.error);
      else router.refresh();
    });
  };

  return (
    <Stack spacing={1.5}>
      {failed ? <Alert severity="error" onClose={() => setFailed(null)}>{failed}</Alert> : null}

      {alerts.map((alert) => {
        const parts = Object.entries(alert.filters).filter(([, value]) => value);
        return (
          <Stack key={alert.id} direction="row" spacing={2}
            sx={{ p: 2.25, borderRadius: 2, alignItems: "flex-start",
                  border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1">{alert.label}</Typography>

              {parts.length ? (
                <Stack direction="row" spacing={0.75} useFlexGap
                  sx={{ flexWrap: "wrap", mt: 1 }}>
                  {parts.map(([key, value]) => (
                    <Chip key={key} size="small"
                      label={`${FILTER_LABELS[key] ?? key}: ${value}`}
                      sx={{ bgcolor: tokens.surface, fontFamily: mono,
                            fontSize: "0.68rem" }} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.5 }}>
                  Every event, with no filters.
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
              <Button size="small" variant="outlined" href={hrefFor(alert)}
                startIcon={<SearchIcon sx={{ fontSize: 16 }} />}
                sx={{ color: tokens.ink, borderColor: tokens.rule }}>
                Run it
              </Button>
              <IconButton size="small" disabled={pending}
                aria-label={`Delete ${alert.label}`}
                onClick={() => setConfirming(alert)}
                sx={{ color: tokens.inkMuted }}>
                <DeleteOutlineIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </Stack>
          </Stack>
        );
      })}

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this alert?"
        body={`"${confirming?.label ?? ""}" will stop watching for matching events. This cannot be undone.`}
        confirmLabel="Delete it"
        destructive
        busy={pending}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove(confirming)}
      />
    </Stack>
  );
}
