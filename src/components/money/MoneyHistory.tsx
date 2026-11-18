"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PaymentsIcon from "@mui/icons-material/Payments";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import NotesIcon from "@mui/icons-material/StickyNote2Outlined";
import { mono, tokens } from "@/lib/tokens";
import { messageTime } from "@/utils/dates";
import {
  SIDE_LABELS, audienceTag, moneyEventLine, moneyEventNote, moneyEventTone,
  type MoneyEvent,
} from "@/utils/money-events";

/**
 * What has happened to this money, drawn the same way everywhere.
 *
 * The shop's order log is where the shape comes from, because it is the one
 * the client asked the rest of the site to copy: a left-ruled stack of lines,
 * each saying what happened, who wrote it and when. What is new is that the
 * lines are typed, so a payment and a refund do not read as the same kind of
 * event, and the date is the thing the caption leads with rather than
 * trailing — "store the date of the original payment, and the date of the
 * refund" is the whole of the ask.
 *
 * Colour never carries it alone: every line has its own icon and its own
 * words, so a refund is legible without seeing the red.
 */

const ICONS = {
  payment: PaymentsIcon,
  refund: CurrencyExchangeIcon,
  status: SyncAltIcon,
  note: NotesIcon,
} as const;

const COLOURS: Record<string, string> = {
  kept: tokens.positive,
  waiting: tokens.brass,
  refunded: tokens.danger,
  down: tokens.danger,
  quiet: tokens.inkMuted,
};

/** Six lines is three payments and three refunds, which is a long history. */
const FOLD_AT = 6;

export default function MoneyHistory({
  events, emptyText = "Nothing recorded yet.", showSide = false, dense = false,
  shownNote = "", showAudience = false,
}: {
  events: MoneyEvent[];
  emptyText?: string;
  /** A table booking is paid a side at a time, so its log says which. */
  showSide?: boolean;
  dense?: boolean;
  /**
   * A note the row above already shows.
   *
   * Every screen that draws this also draws the payment's current note on its
   * own line, because that is the state of the row. The log then carried the
   * same words again directly underneath, which reads as a rendering fault
   * rather than as two facts. A note that has since been corrected still
   * shows, because then it is not the same words.
   */
  shownNote?: string;
  /**
   * Say who reads each typed note (0238).
   *
   * Only on the club's own screens. On the member's it would answer a
   * question they are not asking: everything they can see is something they
   * can see.
   */
  showAudience?: boolean;
}) {
  const [all, setAll] = useState(false);

  if (!events.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {emptyText}
      </Typography>
    );
  }

  const folded = !all && events.length > FOLD_AT;
  // The last few, because a history is read for what happened most recently
  // and the oldest line is the one somebody already knows about.
  const showing = folded ? events.slice(events.length - FOLD_AT) : events;

  return (
    <Stack spacing={dense ? 0.75 : 1}>
      {folded ? (
        <Button size="small" variant="text" onClick={() => setAll(true)}
          sx={{ alignSelf: "flex-start", minWidth: 0, px: 0.5 }}>
          Show all {events.length}
        </Button>
      ) : null}

      <Stack spacing={dense ? 0.75 : 1}
        sx={{ pl: 1.5, borderLeft: `2px solid ${tokens.rule}` }}>
        {showing.map((event) => {
          const Icon = ICONS[event.kind] ?? NotesIcon;
          const tone = moneyEventTone(event);
          const colour = tone ? COLOURS[tone] : tokens.inkMuted;
          const note = moneyEventNote(event);
          const repeat = Boolean(note) && note === shownNote.trim();

          return (
            <Stack key={event.id} direction="row" spacing={1}
              sx={{ alignItems: "flex-start" }}>
              <Icon sx={{ fontSize: 15, color: colour, mt: "3px", flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2"
                  sx={{ color: event.kind === "note" ? tokens.ink : colour,
                        fontWeight: event.kind === "note" ? 400 : 600,
                        fontStyle: event.kind === "note" && event.automatic
                          ? "italic" : "normal" }}>
                  {moneyEventLine(event)}
                </Typography>

                {note && !repeat ? (
                  <Typography variant="body2"
                    sx={{ color: tokens.inkMuted, fontSize: "0.82rem" }}>
                    {note}
                  </Typography>
                ) : null}

                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                  letterSpacing: "0.06em", color: tokens.inkMuted }}>
                  {[
                    messageTime(event.at),
                    showSide && event.side ? SIDE_LABELS[event.side] : "",
                    event.author,
                    showAudience ? audienceTag(event) : "",
                  ].filter(Boolean).join(" · ").toUpperCase()}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}
