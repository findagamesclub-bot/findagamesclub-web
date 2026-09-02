"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import SubmitButton from "@/components/ui/SubmitButton";
import { sinceLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { BoardState }
  from "@/app/clubs/[slug]/events/[eventId]/board/actions";
import type { BoardPost } from "@/services/eventBoard.service";

/**
 * One thread: the notice, its replies, and a box to answer in.
 *
 * The reply box is closed until asked for. A tournament board is read far more
 * often than written to, and eight open textareas down a page is a form, not a
 * noticeboard.
 *
 * Every control is its own form rather than a button calling the action. That
 * is what makes a spinner belong to the thing that was clicked: useFormStatus
 * reads the form it sits in, so removing one reply cannot light up every
 * Remove button on the board.
 */
export default function BoardThread({
  post, faction, viewerId, canManage, action, fields, state,
}: {
  post: BoardPost;
  faction: Faction;
  viewerId: string | null;
  canManage: boolean;
  /** The action from useActionState, handed straight to each form. */
  action: (data: FormData) => void;
  /** slug, eventKey and eventId, as hidden inputs. */
  fields: React.ReactNode;
  /** The board's action state, so the reply box shuts once one lands. */
  state: BoardState;
}) {
  const [asked, setAsked] = useState(false);
  const [openedWith, setOpenedWith] = useState<BoardState>(state);
  const replying = asked && !(state !== openedWith && state.notice);
  const setReplying = (open: boolean) => {
    if (open) setOpenedWith(state);
    setAsked(open);
  };
  const mine = (authorId: string) => viewerId === authorId;

  return (
    <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
               backgroundColor: tokens.paper, overflow: "hidden" }}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="subtitle1" sx={{ fontSize: "1.02rem" }}>{post.title}</Typography>
        <Byline name={post.authorName} at={post.createdAt} mine={mine(post.authorId)} />
        <Typography variant="body1" sx={{ whiteSpace: "pre-line", mt: 1.25 }}>
          {post.content}
        </Typography>
      </Box>

      {post.replies.length ? (
        <Stack spacing={0} sx={{ borderTop: `1px solid ${tokens.rule}` }}>
          {post.replies.map((r, i) => (
            <Box key={r.id}
              sx={{ px: { xs: 2, sm: 2.5 }, py: 1.75,
                    borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                    borderLeft: `3px solid ${faction.soft}`,
                    backgroundColor: tokens.surface }}>
              <Byline name={r.authorName} at={r.createdAt} mine={mine(r.authorId)} />
              <Typography variant="body2" sx={{ whiteSpace: "pre-line", mt: 0.75 }}>
                {r.content}
              </Typography>
              {mine(r.authorId) || canManage ? (
                <Box component="form" action={action} sx={{ mt: 0.5, ml: -1 }}>
                  {fields}
                  <input type="hidden" name="intent" value="remove-reply" />
                  <input type="hidden" name="targetId" value={r.id} />
                  <RemoveButton label="Remove" pendingLabel="Removing the reply" size={15} />
                </Box>
              ) : null}
            </Box>
          ))}
        </Stack>
      ) : null}

      <Stack direction="row" spacing={1} useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center",
              px: { xs: 2, sm: 2.5 }, py: 1.5,
              borderTop: `1px solid ${tokens.rule}` }}>
        {replying ? null : (
          <Button size="small" variant="text" startIcon={<ReplyIcon sx={{ fontSize: 16 }} />}
            onClick={() => setReplying(true)}
            sx={{ color: faction.deep, fontSize: "0.78rem" }}>
            Reply
          </Button>
        )}
        {mine(post.authorId) || canManage ? (
          <Box component="form" action={action}>
            {fields}
            <input type="hidden" name="intent" value="remove-post" />
            <input type="hidden" name="targetId" value={post.id} />
            <RemoveButton label="Remove thread" pendingLabel="Removing the thread" size={16} />
          </Box>
        ) : null}
      </Stack>

      {replying ? (
        <Box component="form" action={action} sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5, pt: 0.5 }}>
          {fields}
          <input type="hidden" name="intent" value="reply" />
          <input type="hidden" name="postId" value={post.id} />
          <TextField name="content" label="Your reply" fullWidth multiline minRows={3}
            required autoFocus slotProps={{ htmlInput: { maxLength: 4000 } }} />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <SubmitButton label="Post reply" pendingLabel="Posting the reply"
              size="small" sx={{ minHeight: 40 }} />
            <Button size="small" onClick={() => setReplying(false)}>Cancel</Button>
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

/** Quiet until pressed, and only this one spins: useFormStatus reads its form. */
function RemoveButton({ label, pendingLabel, size }: {
  label: string; pendingLabel: string; size: number;
}) {
  return (
    <SubmitButton
      label={label}
      pendingLabel={pendingLabel}
      variant="text"
      size="small"
      startIcon={<DeleteOutlinedIcon sx={{ fontSize: size }} />}
      sx={{ color: tokens.inkMuted, fontSize: "0.75rem",
            "&:hover": { color: tokens.danger, backgroundColor: "transparent" } }}
    />
  );
}

function Byline({ name, at, mine }: { name: string; at: string; mine: boolean }) {
  return (
    <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", letterSpacing: "0.04em",
                      color: tokens.inkMuted, mt: 0.25 }}>
      {`${mine ? "You" : name} · ${sinceLabel(at) ?? ""}`}
    </Typography>
  );
}
