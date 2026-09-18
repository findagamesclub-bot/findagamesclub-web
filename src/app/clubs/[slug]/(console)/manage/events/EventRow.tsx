"use client";

import { useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { nightLabel } from "@/utils/dates";
import { FROM_MANAGE_EVENTS } from "@/utils/back-link";
import type { ManageEvent } from "@/utils/event-manage-filter";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * One event on the club's list.
 *
 * Edit is the button because it is what somebody came for; everything else is
 * behind the menu. A row of six outlined buttons was the first draft and it
 * read as a toolbar rather than as an event.
 */
export default function EventRow({
  slug, event, busy, onPublish, onUnpublish, onCancel, onDelete,
}: {
  slug: string;
  event: ManageEvent;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const at = (path: string) => `/clubs/${slug}/manage/events/${event.id}${path}`;
  // The two pages that are not the editor get the trail, so back comes here.
  const from = (path: string) => `${at(path)}?from=${FROM_MANAGE_EVENTS}`;

  const when = event.startDate
    ? [nightLabel(event.startDate),
       event.endDate && event.endDate !== event.startDate
         ? `to ${nightLabel(event.endDate)}` : ""].filter(Boolean).join(" ")
    : "No date yet";

  const booked = event.ticketsAvailable !== null
    ? `${event.bookings} of ${event.ticketsAvailable} booked`
    : event.bookings ? `${event.bookings} booked` : "";

  const pick = (run: () => void) => () => { setMenu(null); run(); };

  return (
    <Box sx={{ display: "grid", gap: 1.5, alignItems: "center", p: 1.75,
               borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
               backgroundColor: tokens.paper,
               gridTemplateColumns: { xs: "minmax(0, 1fr) auto",
                                      md: "minmax(0, 1.6fr) minmax(0, 1fr) auto auto" } }}>
      <Stack spacing={0.4} sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <Typography sx={{ fontFamily: display, fontSize: "1rem", fontWeight: 700 }} noWrap>
            {event.title}
          </Typography>
          {/* Published needs no chip: it is the ordinary state, and a badge on
              every row says nothing. */}
          {event.status === "draft" ? (
            <Chip label="Draft" size="small"
              sx={{ height: 20, fontSize: "0.65rem", fontFamily: mono,
                    backgroundColor: tokens.surface, color: tokens.inkMuted }} />
          ) : null}
          {event.status === "cancelled" ? (
            <Chip label="Called off" size="small"
              sx={{ height: 20, fontSize: "0.65rem", fontFamily: mono,
                    backgroundColor: tokens.brassSoft, color: tokens.ink }} />
          ) : null}
        </Stack>
        <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.08em",
                          color: tokens.inkMuted }}>
          {[when, event.venueName].filter(Boolean).join(" · ").toUpperCase()}
        </Typography>
      </Stack>

      {/* Its own line on a phone rather than squeezed beside a name that is
          already truncating. */}
      <Typography variant="body2"
        sx={{ color: event.bookings ? tokens.ink : tokens.inkMuted, minWidth: 0,
              gridColumn: { xs: "1 / -1", md: "auto" } }}>
        {booked || "Nobody booked yet"}
      </Typography>

      <Button component={NextLink} href={at("")} size="small" variant="outlined"
        sx={{ justifySelf: "end", flexShrink: 0,
              gridColumn: { xs: "1", md: "auto" }, alignSelf: "center" }}>
        Edit
      </Button>

      <IconButton size="small" aria-label={`More for ${event.title}`} disabled={busy}
        onClick={(e) => setMenu(e.currentTarget)}
        sx={{ justifySelf: "end", color: tokens.inkMuted }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}>
        <MenuItem component={NextLink} href={from("/pairings")}>The draw</MenuItem>
        <MenuItem component={NextLink} href={from("/roster")}>
          Who is coming{event.bookings ? ` (${event.bookings})` : ""}
        </MenuItem>
        <MenuItem component={NextLink} href={`/clubs/${slug}/events/${event.legacyId}`}>
          View the public page
        </MenuItem>

        {event.status === "draft" ? (
          <MenuItem onClick={pick(onPublish)}>Publish</MenuItem>
        ) : null}
        {event.status === "published" ? (
          <MenuItem onClick={pick(onUnpublish)}>Take back to a draft</MenuItem>
        ) : null}
        {event.status !== "cancelled" ? (
          <MenuItem onClick={pick(onCancel)}>Call it off</MenuItem>
        ) : (
          <MenuItem onClick={pick(onPublish)}>Put it back on</MenuItem>
        )}

        <MenuItem onClick={pick(onDelete)} sx={{ color: tokens.danger }}>Delete</MenuItem>
      </Menu>
    </Box>
  );
}
