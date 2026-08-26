"use client";

import { useActionState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import HandshakeIcon from "@mui/icons-material/Handshake";
import CloseIcon from "@mui/icons-material/Close";
import { bookingAction, type BookingState } from "@/app/clubs/[slug]/bookings/actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { LookingForGame } from "@/services/lookingForGames.service";

/**
 * Members looking for an opponent on this night.
 *
 * Deliberately not another row in the bookings list: a booking is a table that
 * is taken, a post is an invitation that is open, and showing them the same way
 * was the thing that made the legacy screen hard to read. Accepting turns the
 * post into a real booking with both names on it.
 */
export default function LookingForGames({
  posts, slug, faction, canPlay,
}: {
  posts: LookingForGame[];
  slug: string;
  faction: Faction;
  canPlay: boolean;
}) {
  const [state, submit, busy] = useActionState<BookingState, FormData>(bookingAction, {});

  // Legacy: "No one is currently looking for a game on the upcoming club
  // nights." Per night that is noise, so an empty board simply is not drawn.
  if (!posts.length) return null;

  return (
    <Stack spacing={1.25} sx={{ borderTop: `1px solid ${tokens.rule}`, pt: 1.5 }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        LOOKING FOR A GAME
      </Typography>

      {state.error ? <Alert severity="error" sx={{ fontSize: "0.8rem" }}>{state.error}</Alert> : null}
      {state.notice ? <Alert severity="success" sx={{ fontSize: "0.8rem" }}>{state.notice}</Alert> : null}

      {posts.map((post) => (
        <Stack
          key={post.id}
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{
            alignItems: { sm: "center" }, justifyContent: "space-between",
            px: 1.5, py: 1.25, borderRadius: 1.5,
            bgcolor: faction.soft,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {post.isMine ? "You want" : `${post.authorName} wants`} a game of {post.gameTitle}
            </Typography>
            {post.notes ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
                {post.notes}
              </Typography>
            ) : null}
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            {post.isMine ? (
              <form action={submit}>
                <input type="hidden" name="intent" value="lfg-withdraw" />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="postId" value={post.id} />
                <Button type="submit" variant="outlined" size="small"
                  loading={busy} loadingPosition="start" startIcon={<CloseIcon />}
                  sx={{ bgcolor: tokens.paper, color: tokens.ink, borderColor: tokens.rule,
                        "&:hover": { bgcolor: tokens.paper, color: tokens.danger,
                                     borderColor: tokens.danger } }}>
                  Withdraw
                </Button>
              </form>
            ) : canPlay ? (
              <form action={submit}>
                <input type="hidden" name="intent" value="lfg-accept" />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="postId" value={post.id} />
                <Button type="submit" variant="contained" size="small"
                  loading={busy} loadingPosition="start" startIcon={<HandshakeIcon />}
                  sx={{ bgcolor: faction.base, color: "#FFFFFF",
                        "&:hover": { bgcolor: faction.deep } }}>
                  I&rsquo;ll play
                </Button>
              </form>
            ) : null}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
