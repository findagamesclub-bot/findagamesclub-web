"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Counter from "@/components/ui/Counter";
import { initialsOf } from "@/utils/format";
import { messageTime } from "@/utils/dates";
import ReportButton from "@/components/ui/ReportButton";
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
  replies, faction, busy, last, onRemove, isReported,
}: {
  replies: PendingReply[];
  faction: Faction;
  busy: boolean;
  last: boolean;
  onRemove: (replyId: number) => void;
  /** Asked per reply, so a thread of forty does not scan an array forty times. */
  isReported: (type: string, id: number) => boolean;
}) {
  const lead = replies[0];
  /** Which of somebody else's replies is being asked about. */
  const [asking, setAsking] = useState<number | null>(null);
  const held = replies.find((one) => one.id === asking) ?? null;

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

                {/* Reporting is for people who cannot act. A manager who can
                    take the reply down themselves reporting it to themselves
                    would be a strange thing to offer, which is the rule the
                    thread's own Remove button already follows. */}
                {!reply.isMine && !reply.canRemove && !reply.pending ? (
                  <Box className="reply-remove"
                    sx={{ opacity: 0, transition: "opacity 140ms ease",
                          "&:focus-within": { opacity: 1 },
                          // A phone has no hover, so on one this was a control
                          // that could not be reached at all: a member could
                          // report a post but never a reply. Coarse pointers
                          // get it always; a mouse keeps the quiet line.
                          "@media (hover: none)": { opacity: 1 } }}>
                    <ReportButton type="reply" id={reply.id} what="reply" label=""
                      reported={isReported("reply", reply.id)} />
                  </Box>
                ) : null}
                {/* The club can take a reply down, which it could not before:
                    a thread could only be removed whole, so a single line
                    somebody should not have written meant losing everybody
                    else's. The client asked for it.

                    Two meanings, so two icons: a cross dismisses your own
                    words, a bin takes somebody else's down. One glyph for both
                    is the mistake rule 11 is about, and the two differ in what
                    they cost. Yours goes without asking, because it is yours
                    and removal is soft; somebody else's asks, because on a
                    touch device every one of these is permanently visible and
                    a mis-tap would take a stranger's words off the page. */}
                {reply.canRemove && !reply.pending ? (
                  <Tooltip title={reply.isMine ? "Delete your reply" : "Take this reply down"}>
                    <IconButton
                      className="reply-remove"
                      size="small"
                      disabled={busy}
                      onClick={() => (reply.isMine
                        ? onRemove(reply.id)
                        : setAsking(reply.id))}
                      aria-label={reply.isMine
                        ? "Delete your reply"
                        : `Take down the reply by ${lead.authorName}`}
                      sx={{ p: 0.25, opacity: 0, transition: "opacity 140ms ease",
                            color: tokens.inkMuted,
                            "&:focus-visible": { opacity: 1 },
                            // Same as the report beside it: no hover, no way in.
                            "@media (hover: none)": { opacity: 1 },
                            "&:hover": { color: tokens.danger } }}
                    >
                      {reply.isMine
                        ? <CloseIcon sx={{ fontSize: 14 }} />
                        : <DeleteOutlineIcon sx={{ fontSize: 15 }} />}
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Stack>

      <ConfirmDialog
        open={held !== null}
        title="Take this reply down?"
        body={held
          ? `It comes off the thread for everybody, ${lead.authorName} included, and they are not told. The rest of the conversation stays where it is.`
          : ""}
        confirmLabel="Take it down"
        cancelLabel="Leave it"
        destructive
        busy={busy}
        onConfirm={() => { if (held) onRemove(held.id); setAsking(null); }}
        onClose={() => setAsking(null)}
      />
    </Box>
  );
}
