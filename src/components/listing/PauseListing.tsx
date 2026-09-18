"use client";

import { useActionState, useState, useTransition } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import {
  pauseListingAction, type ListingState,
} from "@/app/clubs/[slug]/(console)/manage/listing/[step]/actions";
import { tokens } from "@/lib/tokens";

/**
 * Stop the listing for a while, and start it again.
 *
 * Legacy's own move and the one we did not copy: a club that closes for the
 * summer or loses its venue had nothing to do but leave a page up inviting
 * people to a night that is not running, or email an admin.
 *
 * Only the owner sees it, because only the owner can do it. A manager editing
 * the listing is not the same kind of act as taking the club out of the
 * directory, and a button that refuses when pressed is worse than no button.
 *
 * The dialog says what actually happens, in both directions, because what
 * people assume pausing means is "my members lose everything" and it is not.
 */
export default function PauseListing({
  slug, paused, canPause, compact = false,
}: {
  slug: string;
  paused: boolean;
  /** Owner or admin. Managers see none of this. */
  canPause: boolean;
  /** Just the button, for a card that has already explained the state. */
  compact?: boolean;
}) {
  const [state, act, working] =
    useActionState<ListingState, FormData>(pauseListingAction, {});
  useActionToast(state);

  const [asking, setAsking] = useState(false);

  // Dispatched from a click rather than a form action, so it needs a transition
  // of its own. Same shape as the approve confirmation in the admin console.
  const [, start] = useTransition();

  if (!canPause) return null;

  return (
    <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
      {compact ? null : (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {paused
          ? "Your club is not in the directory at the moment. Nobody new can find it, "
            + "join it or book a table. Your members still have everything."
          : "Closing for a while? Take the listing out of the directory and put it back "
            + "when you are ready. Nothing is deleted and your members keep everything."}
      </Typography>
      )}

      {/* Outlined, not text. Rule 2: a button must look like a button, and on a
          card whose other actions are buttons a text one reads as a link. */}
      <Button variant={!compact && paused ? "contained" : "outlined"}
        onClick={() => setAsking(true)}
        sx={!compact && paused
          ? undefined
          : { color: tokens.inkMuted, borderColor: tokens.rule,
              alignSelf: "flex-start" }}>
        {compact
          ? (paused ? "Put it back" : "Pause the listing")
          : (paused ? "Put it back in the directory" : "Take it out of the directory")}
      </Button>

      <ConfirmDialog
        open={asking}
        title={paused ? "Put the listing back?" : "Take the listing out?"}
        body={paused
          ? "People will be able to find your club again, join it and book tables. "
            + "Everything is exactly as you left it."
          : "Your club leaves the directory, the map and the events list, and nobody "
            + "new can join or book. Your members keep their membership, the board and "
            + "their bookings, and you can put it back whenever you like."}
        confirmLabel={paused ? "Put it back" : "Take it out"}
        cancelLabel="Not now"
        busy={working}
        onConfirm={() => {
          const data = new FormData();
          data.set("slug", slug);
          data.set("intent", paused ? "resume" : "pause");
          start(() => act(data));
        }}
        onClose={() => setAsking(false)}
      />
    </Stack>
  );
}
