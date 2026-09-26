"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import PostCard from "@/components/board/PostCard";
import EmptyState from "@/components/ui/EmptyState";
import SubmitButton from "@/components/ui/SubmitButton";
import Pager from "@/components/ui/Pager";
import { useLiveEventBoard } from "@/hooks/useLiveEventBoard";
import { useActionToast } from "@/components/ui/Toaster";
import { eventBoardAction, type BoardState }
  from "@/app/clubs/[slug]/(console)/events/[eventId]/board/actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { BoardThread } from "@/services/eventBoard.service";

/**
 * The board for one event: a list of threads, each opening on its own page.
 *
 * It used to render every thread expanded with all of its replies and page the
 * result in the browser. That is fine at four threads and wrong at a hundred:
 * a hundred threads of two hundred replies was twenty thousand rows in one
 * payload to draw eight of them, and the two hundred and first thread silently
 * did not exist. 0132 put the sort key in SQL so this can page there instead,
 * which is what the club board has done since 0037. One board pattern, not two.
 *
 * Only people holding a ticket can read it, which the database enforces rather
 * than this component.
 */
export default function EventBoard({
  threads, total, page, perPage, failed, faction, slug, eventKey, eventId,
}: {
  threads: BoardThread[];
  total: number;
  page: number;
  perPage: number;
  failed: boolean;
  faction: Faction;
  slug: string;
  eventKey: string;
  eventId: number;
}) {
  const [state, submit] = useActionState<BoardState, FormData>(eventBoardAction, {});
  useActionToast(state);
  // A board is read on the day. Somebody asking when round two starts wants
  // the answer, not a page they have to keep refreshing.
  useLiveEventBoard(eventId, true);

  const [asked, setAsked] = useState(false);
  // Closed once a submission has come back with a notice. Compared by identity
  // because useActionState hands back a new object per submission: a string
  // compare would miss a second post carrying the same wording.
  const [openedWith, setOpenedWith] = useState<BoardState>(state);
  const writing = asked && !(state !== openedWith && state.notice);
  const setWriting = (open: boolean) => {
    if (open) setOpenedWith(state);
    setAsked(open);
  };

  const at = `/clubs/${slug}/events/${eventKey}/board`;

  return (
    <Stack spacing={2.5}>
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}

      {writing ? (
        <Box component="form" action={submit}
          sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5,
                border: `1px solid ${faction.base}`, backgroundColor: tokens.paper }}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="eventKey" value={eventKey} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="intent" value="post" />
          <Stack spacing={2}>
            <TextField name="title" label="Title" required fullWidth autoFocus
              helperText="What it is about, in a few words."
              slotProps={{ htmlInput: { maxLength: 200 } }} />
            <TextField name="content" label="Message" required fullWidth multiline minRows={4}
              slotProps={{ htmlInput: { maxLength: 8000 } }} />
            <Stack direction="row" spacing={1}>
              {/* The label holds still and a spinner replaces the start icon.
                  A button that rewrites itself to "Posting…" reads as filler. */}
              <SubmitButton label="Post to the board" pendingLabel="Posting to the board"
                size="medium" sx={{ minHeight: 44 }} />
              <Button onClick={() => setWriting(false)}>Cancel</Button>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <Box>
          <Button variant="contained" onClick={() => setWriting(true)}
            sx={{ minHeight: 44, backgroundColor: faction.base, color: "#FFFFFF",
                  "&:hover": { backgroundColor: faction.deep } }}>
            Start a thread
          </Button>
        </Box>
      )}

      {failed ? (
        <EmptyState title="The board would not load"
          description="Nothing was read, so this is not an empty board. Try again in a moment." />
      ) : threads.length === 0 ? (
        <EmptyState
          title="Nothing on the board yet"
          description="Ask the organisers a question, or tell the other players something they need to know before the day."
        />
      ) : (
        <Stack spacing={2}>
          {/* The same grid the club board uses. Two boards that behave the
              same way have to look the same way. */}
          <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                     gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                            md: "repeat(2, minmax(0, 1fr))",
                                            lg: "repeat(3, minmax(0, 1fr))" } }}>
          {threads.map((thread) => (
            <PostCard key={thread.id} faction={faction}
              href={`${at}/${thread.id}`}
              post={{
                id: thread.id,
                title: thread.title,
                content: thread.content,
                authorName: thread.authorName,
                createdAt: thread.createdAt,
                lastActivityAt: thread.lastActivityAt,
                replyCount: thread.replyCount,
              }} />
          ))}
          </Box>

          <Pager page={page} total={total} size={perPage} noun="threads"
            href={{ path: at, params: {} }} />
        </Stack>
      )}
    </Stack>
  );
}
