"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ThreadList from "./ThreadList";
import { useLiveMessages } from "@/hooks/useLiveMessages";
import { railEntries } from "@/utils/message-rail";
import { tokens } from "@/lib/tokens";
import type { Contact, MessageThread } from "@/types/message";

/**
 * Rail on the left, conversation on the right.
 *
 * On a phone there is no room for both, so the route decides which one shows:
 * the list is the page at /messages, and opening a thread replaces it. That is
 * the same two panes, not a second layout — the rail is still mounted, so
 * coming back is instant and the unread marks are already current.
 */
export default function MessagesShell({
  threads, contacts, viewerId, children,
}: {
  threads: MessageThread[];
  contacts: Contact[];
  viewerId: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const inThread = pathname !== "/messages";

  // Everybody in one list. Starting a conversation and continuing one are the
  // same action from the reader's side, so hiding the people you have not
  // written to yet behind a button made you go and find them first.
  const entries = useMemo(() => railEntries(threads, contacts), [threads, contacts]);

  // One subscription for both panes: a message arriving reorders the rail and
  // lands in the open thread at the same time.
  useLiveMessages(viewerId);

  const unread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 330px) 1fr" },
        // Both panes scroll inside themselves, so the shell needs a real
        // height at every width — without one on a phone the history grows and
        // pushes the composer off the bottom of the page.
        // dvh, not vh: mobile browser chrome collapses on scroll and vh does
        // not follow it, which leaves the composer under the address bar.
        height: { xs: "calc(100dvh - 116px)", md: "calc(100vh - 190px)" },
        minHeight: { md: 520 },
        border: `1px solid ${tokens.rule}`,
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: tokens.paper,
      }}
    >
      <Stack
        sx={{
          minWidth: 0, minHeight: 0,
          display: { xs: inThread ? "none" : "flex", md: "flex" },
          borderRight: { md: `1px solid ${tokens.rule}` },
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{
          px: 2, py: 1.75, alignItems: "baseline", flexShrink: 0,
          borderBottom: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface,
        }}>
          <Typography variant="h2" sx={{ fontSize: "1.15rem" }}>Messages</Typography>
          {unread ? (
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                              letterSpacing: "0.08em", color: tokens.brass, fontWeight: 700 }}>
              {unread} NEW
            </Typography>
          ) : null}
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <ThreadList entries={entries} />
        </Box>
      </Stack>

      <Stack sx={{ minWidth: 0, minHeight: 0,
                   display: { xs: inThread ? "flex" : "none", md: "flex" } }}>
        {children}
      </Stack>
    </Box>
  );
}
