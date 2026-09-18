import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PushPinIcon from "@mui/icons-material/PushPin";
import { sinceLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";

export type EventNotice = { id: number; message: string; createdAt: string };

/**
 * What the club is telling everybody who holds a ticket.
 *
 * A card rather than a paragraph under a heading. This is the one block on the
 * page where the club is speaking directly to the people coming, and it
 * carries the things that have a deadline on them: when the pack goes out,
 * when lists are due, which door to use. Set as body copy it reads as another
 * section; pinned, it reads as a notice.
 *
 * The tint is the club's own colour, the same one it wears everywhere else, so
 * it identifies who is speaking rather than decorating the box.
 *
 * Two kinds of thing sit here, and they are not the same kind. The info board
 * is the standing information, written once and true all weekend. A notice is
 * dated: "the car park is shut that weekend". Legacy keeps both and hands both
 * out only to somebody holding a ticket (club_store.py:2824), so they share
 * one board and the notices carry their dates.
 */
export default function EventNoticeboard({
  text, notices = [], faction,
}: {
  text: string;
  notices?: EventNotice[];
  faction: Faction;
}) {
  return (
    <Stack spacing={1.5}>
      {text ? (
        <Stack direction="row" spacing={1.75}
          sx={{ p: 2.25, borderRadius: 1.5, alignItems: "flex-start",
                backgroundColor: faction.soft, border: `1px solid ${faction.base}33` }}>
          <PushPinIcon sx={{ fontSize: 19, color: faction.deep, flexShrink: 0, mt: 0.25,
                             transform: "rotate(30deg)" }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                              letterSpacing: "0.12em", color: faction.deep, mb: 0.75 }}>
              ATTENDEE UPDATE
            </Typography>
            {/* pre-line, because a club writes these as a few short lines and
                the breaks they typed are the structure. */}
            <Typography variant="body1"
              sx={{ whiteSpace: "pre-line", color: tokens.ink }}>
              {text}
            </Typography>
          </Box>
        </Stack>
      ) : null}

      {notices.length ? (
        <Stack spacing={0}
          sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
          {notices.map((notice, index) => (
            <Stack key={notice.id} spacing={0.5}
              sx={{ p: 2, backgroundColor: tokens.paper,
                    borderTop: index === 0 ? "none" : `1px solid ${tokens.rule}` }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {(sinceLabel(notice.createdAt) ?? "").toUpperCase()}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: "pre-line", color: tokens.ink }}>
                {notice.message}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
