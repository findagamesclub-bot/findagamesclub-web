"use client";

import { useActionState, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import EmptyState from "@/components/ui/EmptyState";
import SubmitButton from "@/components/ui/SubmitButton";
import Pager from "@/components/ui/Pager";
import BoardThread from "./BoardThread";
import { usePagedList } from "@/hooks/usePagedList";
import { useLiveEventBoard } from "@/hooks/useLiveEventBoard";
import { useActionToast } from "@/components/ui/Toaster";
import { eventBoardAction, type BoardState }
  from "@/app/clubs/[slug]/events/[eventId]/board/actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { BoardPost } from "@/services/eventBoard.service";
import { PER_PAGE } from "@/utils/paging";

/** A tournament board is notices, not a forum. Ten to a page is generous. */
const PAGE = PER_PAGE.rich;

/**
 * The board for one event.
 *
 * Only people holding a ticket can read it, which the database enforces rather
 * than this component: an attendee asking "when is list submission due" is
 * asking the other attendees, and the answer is nobody else's business.
 *
 * Newest first, because a board is read for what changed since you last looked.
 */
export default function EventBoard({
  posts, faction, viewerId, canManage, slug, eventKey, eventId,
}: {
  posts: BoardPost[];
  faction: Faction;
  viewerId: string | null;
  canManage: boolean;
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
  // compare would miss a second post carrying the same wording. No effect, so
  // no render that schedules another render.
  const [openedWith, setOpenedWith] = useState<BoardState>(state);
  const writing = asked && !(state !== openedWith && state.notice);
  const setWriting = (open: boolean) => {
    if (open) setOpenedWith(state);
    setAsked(open);
  };

  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(posts, PAGE, top);

  // Handed straight to each form rather than wrapped in startTransition.
  // useFormStatus reads the form it sits in, and that is what scopes a spinner
  // to the control that was pressed: wrapping the action meant the form knew
  // nothing was happening, and the only pending flag left was one shared by
  // the whole board.
  const fields = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="eventKey" value={eventKey} />
      <input type="hidden" name="eventId" value={eventId} />
    </>
  );

  return (
    <Stack spacing={2.5}>
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}

      {writing ? (
        <Box component="form" action={submit}
          sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 1.5,
                border: `1px solid ${faction.base}`, backgroundColor: tokens.paper }}>
          {fields}
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

      {posts.length ? (
        <>
          <Stack ref={top} spacing={2}>
            {paged.shown.map((p) => (
              <BoardThread key={p.id} post={p} faction={faction} viewerId={viewerId}
                canManage={canManage} action={submit} fields={fields} state={state} />
            ))}
          </Stack>
          <Pager page={paged.page} total={paged.total} noun="threads"
            size={PAGE} onChange={paged.goTo} />
        </>
      ) : (
        <EmptyState
          title="Nothing on the board yet"
          description="Ask the organisers a question, or tell the other players something they need to know before the day."
        />
      )}
    </Stack>
  );
}
