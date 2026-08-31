"use client";

import { startTransition, useActionState, useOptimistic } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Counter from "@/components/ui/Counter";
import PollBars from "./PollBars";
import PostPhotos from "./PostPhotos";
import ReplyRow, { type PendingReply } from "./ReplyRow";
import SubmitButton from "@/components/ui/SubmitButton";
import { boardAction, type BoardState } from "@/app/clubs/[slug]/board/actions";
import { initialsOf } from "@/utils/format";
import { messageTime } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { BoardThread } from "@/types/discussion";

/** One thread: the post, its poll, its replies, and the box to add one. */
/**
 * Consecutive replies by one person, in one run. Split here rather than in the
 * service because it is a rendering decision, not a fact about the data.
 */
function groupByAuthor(replies: PendingReply[]): PendingReply[][] {
  return replies.reduce<PendingReply[][]>((runs, reply) => {
    const current = runs.at(-1);
    // Pending replies key off the name, since they have no id yet.
    if (current && current[0].authorName === reply.authorName
        && Boolean(current[0].pending) === Boolean(reply.pending)) {
      current.push(reply);
      return runs;
    }
    return [...runs, [reply]];
  }, []);
}

export default function ThreadView({
  thread, slug, faction, canPost, viewerName,
}: {
  thread: BoardThread;
  slug: string;
  faction: Faction;
  canPost: boolean;
  viewerName: string;
}) {
  const [state, submit, busy] = useActionState<BoardState, FormData>(boardAction, {});
  useActionToast(state);

  /**
   * The reply appears the moment it is sent, held back at half opacity with a
   * SENDING mark, and settles into place when the server confirms it. A
   * spinner on the button alone tells you the app is busy; this tells you what
   * it is busy doing, which is the thing worth knowing.
   */
  const [replies, addOptimistic] = useOptimistic<PendingReply[], { content: string; at: string }>(
    thread.replies,
    (current, draft) => [
      ...current,
      {
        id: -1,
        content: draft.content,
        authorId: "",
        authorName: viewerName,
        createdAt: draft.at,
        isMine: true,
        canRemove: false,
        pending: true,
      },
    ],
  );

  const send = (fields: Record<string, string | number>) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("postId", String(thread.id));
    for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
    // Wrapped, because these fire from click handlers rather than a form. An
    // action dispatched outside a transition still runs, but `busy` never
    // flips, so every control it disables stays live through the round trip.
    startTransition(() => submit(data));
  };

  return (
    <Stack spacing={3}>

      {/* The notice itself, lifted off the page. Everything under it hangs
          from its spine, so the thread reads as one conversation. */}
      <Box sx={{ border: `1px solid ${tokens.rule}`,
                 borderRadius: 1.5, backgroundColor: tokens.paper, p: { xs: 2, sm: 2.75 },
                 boxShadow: "0 1px 10px rgba(16,27,45,0.05)" }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", mb: 2 }}>
          <Counter kind="person" faction={faction} tone="solid"
            primary={initialsOf(thread.authorName)} />
          <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
              {thread.authorName}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                              letterSpacing: "0.06em", color: tokens.inkMuted }}>
              {messageTime(thread.createdAt)}
            </Typography>
          </Stack>

          {thread.canRemove ? (
            <Button size="small" variant="text" disabled={busy}
              onClick={() => send({ intent: "remove-post" })}
              sx={{ color: tokens.inkMuted, flexShrink: 0, textTransform: "none",
                    "&:hover": { color: tokens.danger, backgroundColor: "transparent" } }}>
              {thread.isMine ? "Delete" : "Remove"}
            </Button>
          ) : null}
        </Stack>

        <Typography variant="body1"
          sx={{ whiteSpace: "pre-line", mb: thread.poll && !thread.images.length ? 3 : 0 }}>
          {thread.content}
        </Typography>

        <PostPhotos images={thread.images} />

        {thread.poll ? (
          <Box sx={{ mt: thread.images.length ? 3 : 0, pt: 2.5, borderTop: `1px solid ${tokens.rule}` }}>
            <PollBars poll={thread.poll} faction={faction} busy={busy} canVote={canPost}
              onVote={(optionKey) => send({ intent: "vote", optionKey })} />
          </Box>
        ) : null}
      </Box>

      <Box>
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                          letterSpacing: "0.12em", color: tokens.inkMuted, mb: 1.5 }}>
          {replies.length === 0
            ? "NO REPLIES YET"
            : `${replies.length} ${replies.length === 1 ? "REPLY" : "REPLIES"}`}
        </Typography>

        <Box>
          {groupByAuthor(replies).map((run, i, runs) => (
            <ReplyRow key={`${run[0].id}-${i}`} replies={run} faction={faction} busy={busy}
              last={i === runs.length - 1}
              onRemove={(replyId) => send({ intent: "remove-reply", replyId })} />
          ))}
        </Box>
      </Box>

      {canPost ? (
        <>
          <Divider />
          {/* A real form rather than an onClick: useFormStatus then drives the
              spinner, and React clears the field only once the reply has
              actually landed — clearing it on click both killed the spinner
              (an empty box disabled the button) and lost the text if the
              post failed. */}
          <Box
            component="form"
            action={(data: FormData) => {
              // Inside the action, so the optimistic reply is tied to this
              // submission and rolls back on its own if the post fails.
              addOptimistic({
                content: String(data.get("content") ?? ""),
                at: new Date().toISOString(),
              });
              submit(data);
            }}
          >
            <input type="hidden" name="intent" value="reply" />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="postId" value={thread.id} />

            <Stack spacing={1.5}>
              <TextField
                name="content"
                label="Add a reply"
                multiline
                minRows={3}
                fullWidth
                required
                slotProps={{ htmlInput: { maxLength: 4000 } }}
              />
              <SubmitButton
                label="Post reply"
                pendingLabel="Posting your reply"
                sx={{ alignSelf: "flex-start", backgroundColor: faction.base,
                      "&:hover": { backgroundColor: faction.deep } }}
              />
            </Stack>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
