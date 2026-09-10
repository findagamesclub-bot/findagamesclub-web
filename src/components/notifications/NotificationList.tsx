"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmptyState from "@/components/ui/EmptyState";
import { readAllAction } from "@/app/notification-actions";
import { useLiveNotices } from "@/hooks/useLiveNotices";
import { notificationHref } from "@/utils/notification-href";
import { sinceLabel } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { Notification } from "@/services/notifications.service";

/**
 * Everything the bell has told you.
 *
 * A component rather than a page, because it is drawn twice: at its own public
 * address, and inside the admin console, whose rail is the only navigation an
 * admin has once the header is hidden.
 *
 * Opening it is reading it. A badge that stays up after somebody has been
 * through the list is one they learn to ignore, and the bell's "Mark all read"
 * is a chore to ask of a reader who has just read them.
 */
export default function NotificationList({
  notices, viewerId = null, isAdmin = false,
}: {
  notices: Notification[];
  /** Whose list this is. Null only where the page has no viewer to name. */
  viewerId?: string | null;
  /** Decides which messages shell a message notice opens in. */
  isAdmin?: boolean;
}) {
  useLiveNotices(viewerId);

  // Which arrived new during this visit, kept for the whole of it. Marking
  // them read is what clears the badge; taking the marks off the rows in the
  // same moment would remove the only thing saying which ones to look at.
  // Adding to it while rendering is safe because it only ever grows and the
  // same id twice is the same set.
  const seen = useRef(new Set<number>());
  const wasNew = seen.current;
  for (const notice of notices) {
    if (!notice.read) wasNew.add(notice.id);
  }

  const unreadNow = notices.some((notice) => !notice.read);
  useEffect(() => {
    if (unreadNow) void readAllAction();
  }, [unreadNow]);

  return (
    <>
    {notices.length ? (
        <Stack spacing={1}>
          {notices.map((notice) => {
            const href = notificationHref(notice.href, isAdmin);
            const unread = wasNew.has(notice.id);
            const row = (
              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "flex-start", p: 2, borderRadius: 1.5,
                      // Read or not is the only thing the frame says. The site's
                      // blue used to be held after reading, which left a notice
                      // somebody had just dealt with looking exactly like one
                      // waiting: the icon line under the title carries who it
                      // came from, and that is where identity belongs.
                      border: `1px solid ${
                        unread
                          ? notice.kind === "site_message" ? tokens.brand : tokens.brass
                          : tokens.rule}`,
                      backgroundColor: unread
                        ? notice.kind === "site_message" ? tokens.brandSoft : tokens.brassSoft
                        : tokens.paper,
                      ...(href ? { "&:hover": { borderColor: tokens.brass } } : {}) }}>
                <Stack spacing={0.375} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: unread ? 700 : 500 }}>
                    {notice.title}
                  </Typography>
                  {/* Who wrote it, in the rail's own shorthand. The site's blue
                      when it came from the site, so the line that says SITE
                      ADMIN is the colour the reader already reads as official. */}
                  {notice.meta ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                      letterSpacing: "0.1em",
                                      color: notice.kind === "site_message"
                                        ? tokens.brand : tokens.brass }}>
                      {notice.meta}
                    </Typography>
                  ) : null}
                  {notice.body ? (
                    // Two lines of what they said. Enough to answer "does this
                    // need me now", short enough that ten notices are still a
                    // list rather than a page of quoted messages.
                    <Typography variant="body2"
                      sx={{ color: tokens.inkMuted, display: "-webkit-box",
                            WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
                            overflow: "hidden" }}>
                      {notice.body}
                    </Typography>
                  ) : null}
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                    letterSpacing: "0.1em", color: tokens.inkMuted }}>
                    {(sinceLabel(notice.createdAt) ?? "").toUpperCase()}
                  </Typography>
                </Stack>
                {href ? (
                  <ChevronRightIcon sx={{ fontSize: 18, color: tokens.inkMuted, flexShrink: 0 }} />
                ) : null}
              </Stack>
            );

            // A notice with nowhere to go is still worth reading, so it is
            // rendered plain rather than as a link to nothing.
            return href ? (
              <NextLink key={notice.id} href={href}
                style={{ textDecoration: "none", color: "inherit" }}>
                {row}
              </NextLink>
            ) : (
              <Box key={notice.id}>{row}</Box>
            );
          })}
        </Stack>
      ) : (
        <EmptyState
          title="Nothing yet"
          description="Replies, decisions and anything a club needs you to know appear here."
          action={{ label: "Browse the directory", href: "/clubs" }}
        />
      )}
    </>
  );
}
