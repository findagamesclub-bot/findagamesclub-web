"use client";

import { startTransition, useActionState, useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BusyOverlay from "@/components/ui/BusyOverlay";
import { useActionToast } from "@/components/ui/Toaster";
import CancelEventDialog from "../CancelEventDialog";
import { setStatusAction, type EventEditState } from "./actions";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { EditableEvent } from "@/types/eventEditor";

/**
 * Whether the world can see this, and the two pages that run it.
 *
 * At the top rather than the bottom: the first thing somebody opening a draft
 * wants to know is that it is still a draft, and the first thing somebody
 * opening a live event wants is the roster.
 */
export default function PublishPanel({
  slug, event, faction,
}: {
  slug: string;
  event: EditableEvent;
  faction: Faction;
}) {
  const [state, submit, busy] = useActionState<EventEditState, FormData>(setStatusAction, {});
  useActionToast(state);
  const [cancelling, setCancelling] = useState(false);

  const move = (status: string, reason = "") => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("eventId", String(event.id));
    data.set("status", status);
    data.set("reason", reason);
    startTransition(() => submit(data));
  };

  const standing = event.status === "published"
    ? `Live since ${shortDate(event.publishedAt) ?? "you published it"}`
    : event.status === "cancelled" ? "Called off"
    : "Draft. Only your team can see it.";

  const at = (path: string) => `/clubs/${slug}/manage/events/${event.id}${path}`;

  return (
    <BusyOverlay busy={busy} variant="dim" label="Saving">
      <Box sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5,
                 border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
          <Stack spacing={0.4} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                              letterSpacing: "0.1em",
                              color: event.status === "published"
                                ? tokens.positive : tokens.inkMuted }}>
              {standing.toUpperCase()}
            </Typography>
            <Typography sx={{ fontFamily: display, fontSize: "0.95rem", color: tokens.inkMuted }}>
              {event.status === "cancelled"
                ? (event.cancelReason || "No reason was recorded.")
                : "Tickets, the draw and the door list all hang off this event."}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <Button component={NextLink} href={at("/roster")} size="small" variant="outlined"
              startIcon={<GroupsIcon />}>
              Who is coming
            </Button>
            <Button component={NextLink} href={at("/pairings")} size="small" variant="outlined"
              startIcon={<ShuffleIcon />}>
              The draw
            </Button>
            <Button component={NextLink} href={`/clubs/${slug}/events/${event.legacyId}`}
              size="small" variant="outlined" startIcon={<OpenInNewIcon />}>
              View
            </Button>

            {event.status === "draft" ? (
              <Button size="small" variant="contained" onClick={() => move("published")}
                disabled={busy}
                sx={{ "&.MuiButton-containedPrimary": { backgroundColor: faction.base } }}>
                Publish
              </Button>
            ) : null}
            {event.status === "published" ? (
              <>
                <Button size="small" onClick={() => move("draft")} disabled={busy}
                  sx={{ color: tokens.inkMuted }}>
                  Back to a draft
                </Button>
                <Button size="small" onClick={() => setCancelling(true)} disabled={busy}
                  sx={{ color: tokens.danger }}>
                  Call it off
                </Button>
              </>
            ) : null}
            {event.status === "cancelled" ? (
              <Button size="small" variant="contained" onClick={() => move("published")}
                disabled={busy}>
                Put it back on
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>

      <CancelEventDialog
        event={cancelling
          ? { id: event.id, legacyId: event.legacyId, title: event.title,
              status: "published", startDate: event.startDate || null,
              endDate: event.endDate || null, venueName: event.venueName,
              bookings: event.bookings, ticketsAvailable: event.ticketsAvailable }
          : null}
        saving={busy}
        onClose={() => setCancelling(false)}
        onConfirm={(reason) => { setCancelling(false); move("cancelled", reason); }}
      />
    </BusyOverlay>
  );
}
