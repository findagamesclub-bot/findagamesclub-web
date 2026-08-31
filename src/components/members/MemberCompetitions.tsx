import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { CompetitionRecord, PodiumFinish } from "@/services/memberRecords.service";

const place = (rank: number) =>
  rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;

/** Where they finished, league by league. Legacy's League and campaign record. */
export function CompetitionRecords({ records }: { records: CompetitionRecord[] }) {
  if (!records.length) return null;

  return (
    <Box sx={{ borderRadius: 2, overflow: "hidden",
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      {records.map((row, i) => (
        <Stack key={row.id} direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.5, alignItems: "center",
                borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}` }}>
          <Box sx={{ width: 34, flexShrink: 0 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                              color: row.rank === 1 ? tokens.brass : tokens.ink }}>
              {row.rank ? place(row.rank) : "—"}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <NextLink href={`/clubs/${row.club.slug}/competitions`}
              style={{ textDecoration: "none", color: "inherit" }}>
              <Typography sx={{ fontFamily: display, fontWeight: 700,
                                "&:hover": { color: tokens.brand } }} noWrap>
                {row.title}
              </Typography>
            </NextLink>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                              color: tokens.inkMuted }} noWrap>
              {[row.typeLabel, row.season, row.club.name].filter(Boolean).join(" · ").toUpperCase()}
            </Typography>
          </Box>

          <Stack sx={{ alignItems: "flex-end", flexShrink: 0 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700 }}>
              {row.recordLabel}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", color: tokens.inkMuted }}>
              {`${row.played} PLAYED`}
            </Typography>
          </Stack>

          {!row.completed ? (
            <Chip size="small" label="Running"
              sx={{ height: 20, fontSize: "0.62rem", flexShrink: 0,
                    bgcolor: tokens.brassSoft, color: "#5c4310" }} />
          ) : null}
        </Stack>
      ))}
    </Box>
  );
}

/** Podium finishes at events. Legacy's Competition results. */
export function Podiums({ podiums }: { podiums: PodiumFinish[] }) {
  if (!podiums.length) return null;

  return (
    <Stack spacing={1}>
      {podiums.map((row) => (
        <Stack key={row.id} direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.25, borderRadius: 2, alignItems: "center",
                border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                            width: 34, flexShrink: 0,
                            color: row.rank === 1 ? tokens.brass : tokens.ink }}>
            {place(row.rank)}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <NextLink href={row.eventHref} style={{ textDecoration: "none", color: "inherit" }}>
              <Typography sx={{ fontFamily: display, fontWeight: 700,
                                "&:hover": { color: tokens.brand } }} noWrap>
                {row.eventTitle}
              </Typography>
            </NextLink>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                              color: tokens.inkMuted }} noWrap>
              {`${row.club.name.toUpperCase()}${row.date ? ` · ${(shortDate(row.date) ?? "").toUpperCase()}` : ""}`}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
