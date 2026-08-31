import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shortDate, sinceLabel } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { Announcement } from "@/types/clubDetail";

/**
 * The club's notices, newest first.
 *
 * This was one unlabelled blue Alert carrying only the most recent notice, so
 * Didcot's other two were invisible and nothing said what it was. Legacy calls
 * it the Club Noticeboard and pins every notice with the date it went up
 * (detail.js:461), which is the whole point: a notice from Thursday and one
 * from April are not the same news.
 *
 * Pinned paper rather than an alert, because an alert reads as a warning the
 * page is giving you, and this is the club talking to its members.
 */
export default function ClubNoticeboard({ notices }: { notices: Announcement[] }) {
  if (!notices.length) return null;

  return (
    <Box sx={{ display: "grid", gap: 2,
               gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
      {notices.map((notice, i) => {
        const posted = shortDate(notice.createdAt);
        const ago = sinceLabel(notice.createdAt);

        return (
          <Stack
            key={`${notice.createdAt}-${i}`}
            spacing={1}
            sx={{
              position: "relative",
              px: 2.25, pt: 2.5, pb: 2,
              borderRadius: 2,
              backgroundColor: tokens.brassSoft,
              border: `1px solid rgba(184,134,43,0.28)`,
              // Lifted off the page like a note on a board, not sunk into it.
              boxShadow: "0 6px 18px rgba(89,61,18,0.09)",
            }}
          >
            {/* The pin. Legacy draws the same one, and it is what makes the
                section read as a board at a glance. */}
            <Box aria-hidden sx={{
              position: "absolute", top: 10, right: 16,
              width: 15, height: 15, borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #ff9d87, #b73c24 72%)",
              boxShadow: "0 3px 8px rgba(120,34,17,0.3)",
            }} />

            {posted ? (
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                letterSpacing: "0.08em", color: "rgba(92,67,16,0.8)", pr: 3 }}>
                {`ADDED ${posted}`.toUpperCase()}
                {ago ? ` · ${ago.toUpperCase()}` : ""}
              </Typography>
            ) : null}

            <Typography sx={{ whiteSpace: "pre-line", lineHeight: 1.65,
                              fontWeight: 600, color: "#5c4310" }}>
              {notice.message}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}
