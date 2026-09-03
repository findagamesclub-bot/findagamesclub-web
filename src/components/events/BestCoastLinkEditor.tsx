"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import AddLinkIcon from "@mui/icons-material/AddLink";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { bestcoastLinkAction, type LinkState }
  from "@/app/clubs/[slug]/events/[eventId]/link-actions";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * The club's own control for the Best Coast Pairings link.
 *
 * It sits beside the button it fills, not on some settings screen: the club is
 * looking at their event page, sees no link where one should be, and the way
 * to add it is right there. Without this the button was a feature nothing could
 * ever switch on, which is why it kept reading as missing.
 */
export default function BestCoastLinkEditor({
  current, faction, slug, eventKey, eventId,
}: {
  current: string | null;
  faction: Faction;
  slug: string;
  eventKey: string;
  eventId: number;
}) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [state, submit] = useActionState<LinkState, FormData>(bestcoastLinkAction, {});
  useActionToast(state);

  const [asked, setAsked] = useState(false);
  const [openedWith, setOpenedWith] = useState<LinkState>(state);
  // Closed once a save lands. Compared by identity because useActionState
  // hands back a new object each time, and an error keeps it open so the
  // message stays beside the field that caused it.
  const open = asked && !(state !== openedWith && state.notice);

  const has = Boolean((current ?? "").trim());
  const [value, setValue] = useState(current ?? "");
  const typed = value.trim();

  // Nothing to do: no link on the event and nothing typed. Clearing an
  // existing one is a real action though, so an empty box stays live there and
  // the button says what it will actually do.
  const blocked = !typed && !has;
  const clearing = has && !typed;

  return (
    <>
      <Button
        size="small"
        variant={has ? "text" : "outlined"}
        startIcon={has ? <EditOutlinedIcon sx={{ fontSize: 16 }} />
                       : <AddLinkIcon sx={{ fontSize: 18 }} />}
        onClick={() => { setValue(current ?? ""); setOpenedWith(state); setAsked(true); }}
        sx={{ minHeight: 40, whiteSpace: "nowrap",
              color: has ? tokens.inkMuted : faction.deep,
              ...(has ? {} : { borderColor: faction.base,
                               "&:hover": { borderColor: faction.deep,
                                            backgroundColor: faction.soft } }) }}
      >
        {has ? "Change link" : "Add Best Coast Pairings link"}
      </Button>

      <Dialog open={open} onClose={() => setAsked(false)} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <DialogTitle sx={{ pb: 0.5 }}>
          {/* component="span" because DialogTitle already renders an h2, and a
              heading inside a heading is invalid HTML that React refuses to
              hydrate. The variant keeps the type; only the tag changes. */}
          <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
            Best Coast Pairings link
          </Typography>
        </DialogTitle>

        <form action={submit}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="eventKey" value={eventKey} />
          <input type="hidden" name="eventId" value={eventId} />

          <DialogContent dividers>
            <Stack spacing={2}>
              {state.error ? <Alert severity="error">{state.error}</Alert> : null}

              <TextField
                name="url" label="Address" fullWidth autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="bestcoastpairings.com/event/…"
                helperText={has
                  ? "Paste the event's page on Best Coast Pairings. Clear the box to take the button off this event."
                  : "Paste the event's page on Best Coast Pairings."}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />

              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                The button appears on this event and on every list it shows up
                in, and opens in a new tab so nobody loses their place.
              </Typography>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setAsked(false)}>Cancel</Button>
            <SubmitButton
              label={clearing ? "Remove link" : "Save link"}
              pendingLabel={clearing ? "Removing the link" : "Saving the link"}
              blocked={blocked}
              size="medium"
            />
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
