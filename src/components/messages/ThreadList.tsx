"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import SearchIcon from "@mui/icons-material/Search";
import { usePathname } from "next/navigation";
import { clubIdentity } from "@/utils/club-identity";
import { initialsOf } from "@/utils/format";
import { sinceLabel } from "@/utils/dates";
import { fold } from "@/utils/text";
import { tokens } from "@/lib/tokens";
import type { RailEntry } from "@/types/message";

/**
 * Everybody you can talk to, conversations first.
 *
 * The club's colour rides on the person's circle and the club name under it —
 * the same two people have a separate conversation at every club they share,
 * and nothing else on the row would tell those apart. That matters more here
 * than in an inbox: a member hears from several clubs' owners, and the name
 * alone does not say which club they are writing about.
 */
const SEARCH_FROM = 8;

export default function ThreadList({ entries }: { entries: RailEntry[] }) {
  const pathname = usePathname();
  const [term, setTerm] = useState("");

  const shown = useMemo(() => {
    const needle = fold(term.trim());
    if (!needle) return entries;
    return entries.filter(
      (e) => fold(e.personName).includes(needle) || fold(e.clubName).includes(needle),
    );
  }, [entries, term]);

  if (!entries.length) {
    return (
      <Stack spacing={1} sx={{ px: 2.5, py: 4, textAlign: "center" }}>
        <Typography variant="subtitle2">Nobody to talk to yet</Typography>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Join a club and its members appear here.
        </Typography>
      </Stack>
    );
  }

  return (
    <Box>
      {entries.length >= SEARCH_FROM ? (
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${tokens.rule}` }}>
          <TextField
            fullWidth size="small" placeholder="Search people or clubs"
            aria-label="Search people or clubs"
            value={term} onChange={(e) => setTerm(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: tokens.inkMuted }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      ) : null}

      {shown.map((entry, i) => {
        const { faction } = clubIdentity(entry.clubSlug, entry.clubName);
        const href = `/messages/${entry.clubId}/${entry.personId}`;
        const open = pathname === href;

        return (
          <NextLink key={href} href={href}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                px: 2, py: 1.6, alignItems: "center",
                position: "relative",
                borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                backgroundColor: open ? faction.soft : tokens.paper,
                "&:hover": { backgroundColor: open ? faction.soft : tokens.surface },
                // The open thread is marked on the edge that meets the pane it
                // opened, so the rail and the conversation read as one thing.
                "&::after": open
                  ? { content: '""', position: "absolute", right: 0, top: 0, bottom: 0,
                      width: 3, backgroundColor: faction.base }
                  : undefined,
              }}
            >
              <Box sx={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                         display: "grid", placeItems: "center",
                         backgroundColor: open ? faction.base : tokens.paper,
                         border: `1px solid ${faction.base}`,
                         color: open ? "#fff" : faction.deep }}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                  fontSize: "0.78rem" }}>
                  {initialsOf(entry.personName)}
                </Typography>
              </Box>

              <Stack spacing={0.15} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1}
                  sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                  <Typography
                    sx={{ fontFamily: "var(--font-display)", fontSize: "0.92rem",
                          fontWeight: entry.unread ? 700 : 600, lineHeight: 1.3,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.personName}
                  </Typography>
                  {entry.latestAt ? (
                    <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                                      color: tokens.inkMuted, flexShrink: 0 }}>
                      {(sinceLabel(entry.latestAt) ?? "").toUpperCase()}
                    </Typography>
                  ) : null}
                </Stack>

                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                                  letterSpacing: "0.08em", color: faction.deep,
                                  overflow: "hidden", textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" }}>
                  {entry.clubName.toUpperCase()}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="body2"
                    sx={{ flex: 1, minWidth: 0,
                          color: entry.latest ? tokens.inkMuted : tokens.rule,
                          fontStyle: entry.latest ? "normal" : "italic",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          fontWeight: entry.unread ? 600 : 400 }}>
                    {entry.latest ?? "No messages yet"}
                  </Typography>
                  {entry.unread ? (
                    <Box sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 999, flexShrink: 0,
                               display: "grid", placeItems: "center",
                               backgroundColor: tokens.brass }}>
                      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                                        fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                        {entry.unread}
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>
              </Stack>
            </Stack>
          </NextLink>
        );
      })}

      {shown.length === 0 ? (
        <Typography variant="body2" sx={{ px: 2, py: 3, color: tokens.inkMuted }}>
          Nobody by that name.
        </Typography>
      ) : null}
    </Box>
  );
}
