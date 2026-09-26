"use client";

import { useActionState } from "react";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Pager from "@/components/ui/Pager";
import BoardThread from "./BoardThread";
import { useReported } from "@/hooks/useReported";
import { useLiveEventBoard } from "@/hooks/useLiveEventBoard";
import { useActionToast } from "@/components/ui/Toaster";
import { eventBoardAction, type BoardState }
  from "@/app/clubs/[slug]/(console)/events/[eventId]/board/actions";
import type { BoardThreadPage } from "@/services/eventBoard.service";
import type { ReportedKeys } from "@/utils/reported-set";
import type { Faction } from "@/lib/tokens";

/**
 * One thread, with its replies paged.
 *
 * The action, the toast and the live refresh live here rather than in
 * `BoardThread`, which stays a rendering component and is handed the same
 * `action`, `fields` and `state` the list used to hand it.
 */
export default function EventThread({
  board, faction, viewerId, canManage, slug, eventKey, eventDbId, reported,
}: {
  board: BoardThreadPage;
  faction: Faction;
  viewerId: string | null;
  canManage: boolean;
  slug: string;
  eventKey: string;
  eventDbId: number;
  reported: ReportedKeys;
}) {
  const isReported = useReported(reported);
  const [state, submit] = useActionState<BoardState, FormData>(eventBoardAction, {});
  useActionToast(state);
  useLiveEventBoard(eventDbId, true);

  const fields = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="eventKey" value={eventKey} />
      <input type="hidden" name="eventId" value={eventDbId} />
    </>
  );

  return (
    <Stack spacing={2}>
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}

      {/* Older first and the last page by default, because a conversation is
          read forward and the reply box sits at the end of it. */}
      {board.total > board.perPage ? (
        <Pager page={board.page} total={board.total} size={board.perPage}
          noun="replies"
          href={{ path: `/clubs/${slug}/events/${eventKey}/board/${board.thread.id}`,
                  params: {} }} />
      ) : null}

      <BoardThread
        post={board.thread}
        replies={board.replies}
        faction={faction}
        viewerId={viewerId}
        canManage={canManage}
        action={submit}
        fields={fields}
        state={state}
        isReported={isReported}
      />
    </Stack>
  );
}
