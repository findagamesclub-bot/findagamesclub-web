"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import { useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Divider from "@mui/material/Divider";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import NotificationsIcon from "@mui/icons-material/NotificationsActiveOutlined";
import NextLink from "next/link";
import { useFormStatus } from "react-dom";
import { saveAlertAction, type AlertState } from "@/app/events/actions";
import { tokens } from "@/lib/tokens";

/** What the URL calls a filter versus what a person calls it. */
const NAMES: Record<string, string> = {
  q: "Search", location: "Near", city: "City", format: "Format", day: "Day",
  eventType: "Type", featuredGame: "Game", facility: "Facility",
  withinMiles: "Within", dateFrom: "From", dateTo: "To", when: "Timing",
};

/**
 * Keep this search and hear about new matches.
 *
 * The dialog shows the filters it is about to save rather than trusting people
 * to remember what they had set. Saving a search you cannot see is how you end
 * up with four alerts and no idea which is which.
 */
export default function SaveAlertButton({
  canSave, preset, trigger, title = "Save this search",
}: {
  canSave: boolean;
  /**
   * A search to save instead of the one in the URL. An event card passes its
   * own game and town, so "notify of similar events" means events like
   * this one rather than whatever happened to be filtered at the time.
   */
  preset?: Record<string, string>;
  trigger?: (open: () => void) => React.ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const fullScreen = useMediaQuery("(max-width:600px)");

  const filters = useMemo(() => {
    if (preset) {
      return Object.fromEntries(Object.entries(preset).filter(([, v]) => v));
    }
    const kept: Record<string, string> = {};
    for (const key of Object.keys(NAMES)) {
      const value = params.get(key);
      if (value) kept[key] = value;
    }
    return kept;
  }, [params, preset]);

  const entries = Object.entries(filters);
  // Prefixes belong on the chips, where they disambiguate. In the name they
  // just make it long enough to truncate.
  const suggested = entries.length
    ? entries.map(([k, v]) => (k === "withinMiles" ? `${v} miles` : v)).join(" · ").slice(0, 80)
    : "";

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : (
        <Button variant="outlined" startIcon={<NotificationsIcon />} onClick={() => setOpen(true)}
          sx={{ borderColor: tokens.rule, color: tokens.ink, whiteSpace: "nowrap" }}>
          Save alert
        </Button>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
        slotProps={{ paper: { sx: { maxWidth: 720 } } }}
        fullScreen={fullScreen}>
        <DialogTitle sx={{ pr: 7, pt: 3.5, px: { sm: 3.5 }, pb: 2.5 }}>
          <Stack spacing={0.5}>
            <Typography variant="h2" sx={{ fontSize: { xs: "1.5rem", sm: "1.8rem" } }}>
              {title}
            </Typography>
            <Typography variant="body1" sx={{ color: tokens.inkMuted, fontWeight: 400 }}>
              We will let you know when a new event matches it.
            </Typography>
          </Stack>
          <IconButton onClick={() => setOpen(false)} aria-label="Close"
            sx={{ position: "absolute", right: 14, top: 16 }}>
            <CloseIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ pt: 3.5, px: { sm: 3.5 }, pb: 1 }}>
          {!canSave ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Alerts are saved to your account, so you will need to sign in first.
              </Typography>
              <NextLink href="/auth/sign-in?next=/events" style={{ textDecoration: "none" }}>
                <Button fullWidth variant="contained">Sign in</Button>
              </NextLink>
            </Stack>
          ) : (
            <AlertForm filters={filters} entries={entries} suggested={suggested}
              onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AlertForm({
  filters, entries, suggested, onSaved, onCancel,
}: {
  filters: Record<string, string>;
  entries: [string, string][];
  suggested: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, submit] = useActionState<AlertState, FormData>(saveAlertAction, {});
  useActionToast(state);

  useEffect(() => {
    if (state.saved) {
      const timer = setTimeout(onSaved, 1200);
      return () => clearTimeout(timer);
    }
  }, [state.saved, onSaved]);

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="filters" value={JSON.stringify(filters)} />

      <Stack spacing={2.5}>
        {state.saved ? <Alert severity="success">Saved as “{state.saved}”.</Alert> : null}

        <Stack spacing={1.25}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem",
                            letterSpacing: "0.12em", color: tokens.inkMuted, fontWeight: 700 }}>
            {entries.length ? "THIS SEARCH" : "NOTHING TO SAVE"}
          </Typography>

          {entries.length ? (
            <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                       p: 2, backgroundColor: tokens.surface }}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {entries.map(([key, value]) => (
                  <Chip key={key}
                    label={key === "q" ? value : `${NAMES[key]}: ${value}`}
                    sx={{ height: 34, fontSize: "0.9rem",
                          backgroundColor: tokens.paper, border: `1px solid ${tokens.rule}`,
                          "& .MuiChip-label": { px: 1.5 } }} />
                ))}
              </Stack>
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Set at least one filter first. An empty search matches every event, which
              would alert you about all of them.
            </Typography>
          )}
        </Stack>

        <TextField
          name="label"
          label="Name this alert"
          defaultValue={suggested}
          helperText="Only you see this. It is how the alert is listed in your account."
          fullWidth
          required
          disabled={!entries.length}
          slotProps={{ htmlInput: { maxLength: 80 } }}
        />
      </Stack>

      <DialogActions sx={{ px: 0, pt: 3.5, pb: 1.5 }}>
        <Button onClick={onCancel} size="large" sx={{ color: tokens.inkMuted }}>Cancel</Button>
        <SaveButton disabled={!entries.length} />
      </DialogActions>
    </Box>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" size="large"
      loading={pending} loadingPosition="start"
      startIcon={<NotificationsIcon />}
      disabled={disabled} aria-label="Save this alert"
      sx={{ px: 3 }}>
      Save alert
    </Button>
  );
}
