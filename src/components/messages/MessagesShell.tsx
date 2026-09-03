"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ThreadList from "./ThreadList";
import NewMessageDialog from "./NewMessageDialog";
import Button from "@mui/material/Button";
import EditSquareIcon from "@mui/icons-material/BorderColor";
import { useLiveMessages } from "@/hooks/useLiveMessages";
import { conversationEntries } from "@/utils/message-rail";
import { tokens } from "@/lib/tokens";
import type { Contact, MessageThread } from "@/types/message";

/**
 * Rail on the left, conversation on the right.
 *
 * On a phone there is no room for both, so the route decides which one shows:
 * the list is the page at /account/messages, and opening a thread replaces it. That is
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
  const inThread = pathname !== "/account/messages";

  // Conversations only. Every member of every club used to be in this list,
  // which is fine at two members and unreadable at two hundred: the person you
  // spoke to yesterday sat below ninety strangers. Starting one is its own
  // action now, with its own search.
  const entries = useMemo(() => conversationEntries(threads), [threads]);
  const [picking, setPicking] = useState(false);

  // One subscription for both panes: a message arriving reorders the rail and
  // lands in the open thread at the same time.
  useLiveMessages(viewerId);

  const unread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(280px, 330px) minmax(0, 1fr)" },
        // Both panes scroll inside themselves, so the shell needs a real
        // height. On a phone that is measured from the viewport — dvh, not vh,
        // because mobile browser chrome collapses on scroll and vh does not
        // follow it, which leaves the composer under the address bar. On a
        // desktop the account shell has already worked out the room available,
        // so this just fills it.
        height: { xs: "calc(100dvh - 150px)", md: "100%" },
        minHeight: { md: 480 },
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
          px: 2, py: 1.5, alignItems: "center", flexShrink: 0,
          borderBottom: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface,
        }}>
          <Typography variant="h2" sx={{ fontSize: "1.15rem" }}>Messages</Typography>
          {unread ? (
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                              letterSpacing: "0.08em", color: tokens.brass, fontWeight: 700 }}>
              {unread} NEW
            </Typography>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="contained" onClick={() => setPicking(true)}
            startIcon={<EditSquareIcon sx={{ fontSize: 15 }} />}
            sx={{ flexShrink: 0 }}>
            New
          </Button>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {entries.length ? (
            <ThreadList entries={entries} />
          ) : (
            <Stack spacing={1.25} sx={{ px: 2.5, py: 4, alignItems: "flex-start" }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                No conversations yet. Everybody you share a club with can be
                reached from New.
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setPicking(true)}>
                Start one
              </Button>
            </Stack>
          )}
        </Box>

        <NewMessageDialog contacts={contacts} open={picking}
          onClose={() => setPicking(false)} />
      </Stack>

      <Stack sx={{ minWidth: 0, minHeight: 0,
                   display: { xs: inThread ? "flex" : "none", md: "flex" } }}>
        {children}
      </Stack>
    </Box>
  );
}
