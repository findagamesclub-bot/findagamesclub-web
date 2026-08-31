import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { initialsOf } from "@/utils/format";
import { nightLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { LookingForGame } from "@/services/lookingForGames.service";

/**
 * Members with a night free and nobody to play.
 *
 * Legacy puts this on the club page inside the schedule section
 * (detail.js:944, club-v2-looking-for-game). Ours only existed per night on the
 * booking calendar, where you had to already be looking at the right Thursday
 * to find out somebody wanted a game on it.
 *
 * Posts are members-only, so a visitor is told the board exists rather than
 * shown an empty one.
 */
export default function LookingForGameSummary({
  posts, slug, clubName, faction, isMember,
}: {
  posts: LookingForGame[];
  slug: string;
  clubName: string;
  faction: Faction;
  isMember: boolean;
}) {
  if (!isMember) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <PersonSearchIcon sx={{ fontSize: 17, color: tokens.inkMuted, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Members of {clubName} post when they are looking for an opponent, and take
          each other up on it.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={0.875} sx={{ alignItems: "center" }}>
        <PersonSearchIcon sx={{ fontSize: 17, color: faction.base }} />
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", letterSpacing: "0.12em",
                          color: tokens.inkMuted, fontWeight: 700 }}>
          LOOKING FOR A GAME
        </Typography>
      </Stack>

      {posts.length ? (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
          {posts.map((post, i) => (
            <Stack key={post.id} direction="row" spacing={1.5}
              sx={{ px: 2, py: 1.25, alignItems: "center",
                    borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}` }}>
              <Box sx={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                         display: "grid", placeItems: "center",
                         backgroundColor: faction.soft, color: faction.deep }}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                  fontSize: "0.68rem" }}>
                  {initialsOf(post.authorName)}
                </Typography>
              </Box>

              <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {post.isMine ? "You are" : `${post.authorName} is`} looking
                  {post.gameTitle ? ` for ${post.gameTitle}` : ""}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
                  {nightLabel(post.date)}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nobody is looking for a game right now. Post on a club night you could book,
          and members will see it here.
        </Typography>
      )}

      <NextLink href={`/clubs/${slug}/bookings`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
          {/* Named for where it goes, not for an action it cannot promise:
              posting needs a night you could book, and whether you have one
              depends on the calendar this link opens. */}
          <Typography variant="body2" sx={{ color: faction.deep, fontWeight: 600 }}>
            {posts.length ? "Take somebody up on it" : "Open the club nights"}
          </Typography>
          <ChevronRightIcon sx={{ fontSize: 16, color: faction.deep }} />
        </Stack>
      </NextLink>
    </Stack>
  );
}
