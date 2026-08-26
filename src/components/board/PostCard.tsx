import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import PollIcon from "@mui/icons-material/Poll";
import Counter from "@/components/ui/Counter";
import { sinceLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { BoardPost } from "@/types/discussion";

/**
 * One thread, as a ruled row on the board's sheet.
 *
 * Not a card. Cards with gaps and shadows between them read as a feed of
 * unrelated things; a board is one surface with notices on it, so the rows
 * share a sheet and are separated by a hairline. The Counter carries the reply
 * count, which is the figure that tells you where the conversation is.
 */
export default function PostCard({
  post, slug, faction, first = false,
}: {
  post: BoardPost;
  slug: string;
  faction: Faction;
  first?: boolean;
}) {
  // Only its author and the club ever receive a removed row, so this is not a
  // gap in the board — it is a note to the one or two people it concerns.
  if (post.removed) {
    return (
      <Stack
        direction="row"
        spacing={{ xs: 1.75, sm: 2.25 }}
        sx={{
          px: { xs: 1.75, sm: 2.5 }, py: { xs: 1.75, sm: 2 },
          alignItems: "center",
          borderTop: first ? "none" : `1px solid ${tokens.rule}`,
          backgroundColor: tokens.surface,
        }}
      >
        <Counter kind="slot" faction={faction} primary="—" />
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1"
            sx={{ color: tokens.inkMuted, textDecoration: "line-through" }}>
            {post.title}
          </Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            {post.removed.byMe ? "YOU DELETED THIS" : "REMOVED BY THE CLUB"}
          </Typography>
        </Stack>
      </Stack>
    );
  }

  return (
    <NextLink href={`/clubs/${slug}/board/${post.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Stack
        direction="row"
        spacing={{ xs: 1.75, sm: 2.25 }}
        sx={{
          px: { xs: 1.75, sm: 2.5 },
          py: { xs: 1.75, sm: 2 },
          alignItems: "flex-start",
          borderTop: first ? "none" : `1px solid ${tokens.rule}`,
          transition: "background-color 140ms ease",
          "&:hover": { backgroundColor: faction.soft },
          // The hover tint is the only state colour on the row, so the title
          // still has to move to show it is a link.
          "&:hover .board-title": { color: faction.deep },
        }}
      >
        <Counter faction={faction} primary={String(post.replyCount)} secondary="rep" />

        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                              letterSpacing: "0.12em", color: faction.deep, fontWeight: 700 }}>
              {post.category.toUpperCase()}
            </Typography>
            <Box aria-hidden sx={{ width: 3, height: 3, borderRadius: "50%",
                                   backgroundColor: tokens.rule }} />
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                              letterSpacing: "0.06em", color: tokens.inkMuted }}>
              {post.authorName.toUpperCase()} ·{" "}
              {post.replyCount > 0 && post.lastActivityAt !== post.createdAt
                ? `LAST REPLY ${(sinceLabel(post.lastActivityAt) ?? "").toUpperCase()}`
                : (sinceLabel(post.createdAt) ?? "").toUpperCase()}
            </Typography>

            {post.poll ? (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <PollIcon sx={{ fontSize: 14, color: tokens.brass }} />
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                  color: tokens.brass, fontWeight: 700, letterSpacing: "0.06em" }}>
                  POLL · {post.poll.total}
                </Typography>
              </Stack>
            ) : null}
          </Stack>

          <Typography
            className="board-title"
            variant="h3"
            sx={{ fontSize: { xs: "1.05rem", sm: "1.15rem" }, lineHeight: 1.28,
                  transition: "color 140ms ease" }}
          >
            {post.title}
          </Typography>

          {/* Two lines of the body, in the prose face. Enough to tell threads
              apart; more and the list becomes the thread. */}
          <Typography variant="body2"
            sx={{ color: tokens.inkMuted, display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {post.content}
          </Typography>
        </Stack>
      </Stack>
    </NextLink>
  );
}
