"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import Counter from "@/components/ui/Counter";
import { initialsOf } from "@/utils/format";
import { messageTime } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { BoardReply } from "@/types/discussion";

export type PendingReply = BoardReply & { pending?: boolean };

/**
 * A run of consecutive replies by one person, hung off the thread's spine.
 *
 * Grouped, because a thread is usually two or three people taking turns and
 * repeating the same avatar and name above every line makes nine replies read
 * as nine strangers. One header, then their messages under it — which is how
 * every conversation people already use is laid out.
 */
export default function ReplyRow({
  replies, faction, busy, last, onRemove,
}: {
  replies: PendingReply[];
  faction: Faction;
  busy: boolean;
  last: boolean;
  onRemove: (replyId: number) => void;
}) {
  const lead = replies[0];

  return (
    <Box sx={{ position: "relative", pl: { xs: 3, sm: 4 }, pb: last ? 0 : 2.5 }}>
      <Box aria-hidden sx={{ position: "absolute", left: { xs: 11, sm: 15 }, top: 0, bottom: 0,
                             width: "1px", backgroundColor: last ? "transparent" : tokens.rule }} />
      <Box aria-hidden sx={{ position: "absolute", left: { xs: 11, sm: 15 }, top: 18,
                             width: { xs: 12, sm: 17 }, height: "1px",
                             backgroundColor: tokens.rule }} />

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Counter kind="person" faction={faction} tone={lead.isMine ? "solid" : "soft"}
          primary={initialsOf(lead.authorName)} />

        <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
          <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-display)" }}>
            {lead.authorName}
          </Typography>

          {replies.map((reply) => (
            <Stack
              key={reply.id}
              direction="row"
              spacing={1.25}
              sx={{
                alignItems: "flex-start",
                opacity: reply.pending ? 0.55 : 1,
                transition: "opacity 200ms ease",
                // The control only appears on the line you are pointing at, so
                // a moderator's view is not nine delete links down the page.
                "&:hover .reply-remove": { opacity: 1 },
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-line", flex: 1, minWidth: 0 }}>
                {reply.content}
              </Typography>

              <Stack direction="row" spacing={0.75}
                sx={{ alignItems: "center", flexShrink: 0, pt: 0.35 }}>
                {reply.pending ? (
                  <CircularProgress size={11} thickness={6} sx={{ color: tokens.inkMuted }} />
                ) : (
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                    color: tokens.inkMuted }}>
                    {messageTime(reply.createdAt)}
                  </Typography>
                )}

                {/* Your own words only. The club can still take a whole thread
                    down from the post above, but picking single replies out of
                    somebody else's conversation is not a control worth putting
                    on every line. */}
                {reply.isMine && !reply.pending ? (
                  <Tooltip title="Delete your reply">
                    <IconButton
                      className="reply-remove"
                      size="small"
                      disabled={busy}
                      onClick={() => onRemove(reply.id)}
                      aria-label="Delete your reply"
                      sx={{ p: 0.25, opacity: 0, transition: "opacity 140ms ease",
                            color: tokens.inkMuted,
                            "&:focus-visible": { opacity: 1 },
                            "&:hover": { color: tokens.danger } }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
