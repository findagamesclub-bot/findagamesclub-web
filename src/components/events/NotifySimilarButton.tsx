"use client";

import Button from "@mui/material/Button";
import NotificationsIcon from "@mui/icons-material/NotificationsActiveOutlined";
import SaveAlertButton from "./SaveAlertButton";
import { tokens } from "@/lib/tokens";
import type { EventSummary } from "@/types/eventList";

/**
 * "Notify me about similar events", on an event's card.
 *
 * The alert it saves describes THIS event — its game and its town — not
 * whatever filters happened to be set when the button was pressed. Anything
 * else and "similar events" would mean something different every time.
 */
export default function NotifySimilarButton({
  event, canSave,
}: {
  event: EventSummary;
  canSave: boolean;
}) {
  const preset: Record<string, string> = {
    // The event's own game is the strongest signal of what "similar" means.
    ...(event.featuredGames[0] ? { featuredGame: event.featuredGames[0] } : {}),
    ...(event.eventTypes[0] ? { eventType: event.eventTypes[0] } : {}),
    ...(event.club.city ? { city: event.club.city } : {}),
  };

  return (
    <SaveAlertButton
      canSave={canSave}
      preset={preset}
      title="Notify me about similar events"
      trigger={(open) => (
        <Button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(); }}
          size="small"
          variant="outlined"
          startIcon={<NotificationsIcon sx={{ fontSize: 17 }} />}
          sx={{ borderColor: tokens.rule, color: tokens.inkMuted, whiteSpace: "nowrap",
                "&:hover": { borderColor: tokens.brass, color: tokens.ink } }}
        >
          Notify me
        </Button>
      )}
    />
  );
}
