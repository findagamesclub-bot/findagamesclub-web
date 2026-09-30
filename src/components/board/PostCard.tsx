import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import Image from "next/image";
import PollIcon from "@mui/icons-material/Poll";
import Counter from "@/components/ui/Counter";
import { sinceLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * One thread, as a ruled row on the board's sheet.
 *
 * Not a card. Cards with gaps and shadows between them read as a feed of
 * unrelated things; a board is one surface with notices on it, so the rows
 * share a sheet and are separated by a hairline. The Counter carries the reply
 * count, which is the figure that tells you where the conversation is.
 */
/**
 * What a card needs, which is less than a club board thread carries.
 *
 * Narrower than `BoardPost` on purpose: the event board has no categories, no
 * polls and no photos, and it draws the same card. One card for both boards,
 * because two that match on the day they are written drift the first time
 * either is touched.
 */
export type ThreadSummary = {
  id: number;
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  category?: string;
  poll?: { total: number } | null;
  images?: { url: string; alt: string }[];
  removed?: { byMe: boolean } | null;
};

export default function PostCard({
  post, href, faction,
}: {
  post: ThreadSummary;
  /** Where the card goes. The two boards live at different paths. */
  href: string;
  faction: Faction;
}) {
  const images = post.images ?? [];
  // Only its author and the club ever receive a removed row, so this is not a
  // gap in the board — it is a note to the one or two people it concerns.
  if (post.removed) {
    return (
      <Stack
        direction="row"
        spacing={{ xs: 1.75, sm: 2.25 }}
        sx={{
          height: "100%", p: { xs: 1.75, sm: 2 },
          alignItems: "center", borderRadius: 1.5,
          border: `1px solid ${tokens.rule}`,
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
    <NextLink href={href}
      style={{ textDecoration: "none", color: "inherit", display: "block",
               height: "100%" }}>
      <Stack
        direction="row"
        spacing={{ xs: 1.5, sm: 1.75 }}
        sx={{
          height: "100%", p: { xs: 1.75, sm: 2 },
          alignItems: "flex-start", borderRadius: 1.5,
          border: `1px solid ${tokens.rule}`,
          backgroundColor: tokens.paper,
          transition: "background-color 140ms ease, border-color 140ms ease",
          "&:hover": { backgroundColor: faction.soft, borderColor: faction.base },
          // The hover tint is the only state colour on the card, so the title
          // still has to move to show it is a link.
          "&:hover .board-title": { color: faction.deep },
        }}
      >
        <Counter faction={faction} primary={String(post.replyCount)} secondary="rep" />

        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "center" }}>
            {post.category ? (
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                letterSpacing: "0.12em", color: faction.deep,
                                fontWeight: 700 }}>
                {post.category.toUpperCase()}
              </Typography>
            ) : null}
            {/* No dot between these two. At card width the byline wraps to its
                own line and the separator was left dangling after the
                category, which reads as a missing word. */}
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
            sx={{ fontSize: { xs: "1.02rem", sm: "1.08rem" }, lineHeight: 1.28,
                  transition: "color 140ms ease",
                  // Two lines at card width, so one long title cannot make its
                  // card twice the height of the two beside it.
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {post.title}
          </Typography>

          {/* Two lines of the body, in the prose face. Enough to tell threads
              apart; more and the list becomes the thread. */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Typography variant="body2"
              sx={{ color: tokens.inkMuted, display: "-webkit-box", WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical", overflow: "hidden", minWidth: 0, flex: 1 }}>
              {post.content}
            </Typography>

            {/* One thumbnail, not both: the row is a index entry, and a second
                picture buys nothing at 56px. */}
            {images.length ? (
              <Box sx={{ position: "relative", width: 56, height: 56, flexShrink: 0,
                         borderRadius: 1, overflow: "hidden",
                         border: `1px solid ${tokens.rule}` }}>
                <Image src={images[0]!.url} alt="" fill sizes="56px"
                  style={{ objectFit: "cover" }} />
                {images.length > 1 ? (
                  <Box sx={{ position: "absolute", right: 0, bottom: 0, px: 0.5,
                             fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                             fontWeight: 700, color: "#fff",
                             backgroundColor: "rgba(16,27,45,0.78)" }}>
                    +1
                  </Box>
                ) : null}
              </Box>
            ) : null}
          </Stack>
        </Stack>
      </Stack>
    </NextLink>
  );
}
