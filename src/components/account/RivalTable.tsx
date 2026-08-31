import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { Record as HeadToHead } from "@/services/games.service";

/**
 * Who this member plays, and how it has gone.
 *
 * Ordered by games played rather than by wins, so the people somebody actually
 * has a history with come first. A rivalry is about how often, not how well.
 */
export default function RivalTable({
  records, pinned,
}: {
  records: HeadToHead[];
  /** Ids the member has marked as rivals, pulled to the top. */
  pinned: Set<string>;
}) {
  if (!records.length) return null;

  const ordered = [...records].sort((a, b) => {
    const gap = Number(pinned.has(b.opponentId)) - Number(pinned.has(a.opponentId));
    return gap || b.played - a.played;
  });

  return (
    <Box sx={{ borderRadius: 2, overflow: "hidden",
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      {ordered.map((row, i) => {
        const lead = row.wins > row.losses;
        const behind = row.losses > row.wins;

        return (
          <Stack key={row.opponentId} direction="row" spacing={1.5}
            sx={{ px: 2.25, py: 1.5, alignItems: "center",
                  borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}` }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <NextLink href={`/members/${row.opponentId}`}
                  style={{ textDecoration: "none", color: "inherit" }}>
                  <Typography sx={{ fontFamily: display, fontWeight: 700,
                                    "&:hover": { color: tokens.brand } }} noWrap>
                    {row.opponentName}
                  </Typography>
                </NextLink>
                {pinned.has(row.opponentId) ? (
                  <Chip size="small" label="Rival"
                    sx={{ height: 19, fontSize: "0.62rem", fontWeight: 700,
                          bgcolor: tokens.brassSoft, color: "#5c4310" }} />
                ) : null}
              </Stack>
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tokens.inkMuted }}>
                {`${row.played} PLAYED${row.lastPlayed ? ` · LAST ${(shortDate(row.lastPlayed) ?? "").toUpperCase()}` : ""}`}
              </Typography>
            </Box>

            <Typography sx={{ fontFamily: mono, fontSize: "1.05rem", fontWeight: 700,
                              flexShrink: 0,
                              color: lead ? "#1B5E20" : behind ? tokens.danger : tokens.ink }}>
              {`${row.wins}-${row.draws}-${row.losses}`}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}
