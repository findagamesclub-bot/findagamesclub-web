import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ThreadView from "@/components/board/ThreadView";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getThread } from "@/services/discussions.service";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/board/[postId]">) {
  const { postId } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) return { title: "Board" };
  const thread = await getThread(Number(postId), { id: viewer.id, canManageClub: false });
  return { title: thread ? thread.title : "Thread not found" };
}

export default async function ThreadPage({ params }: PageProps<"/clubs/[slug]/board/[postId]">) {
  const { slug, postId } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/board/${postId}`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const canManageClub = club.ownerId === viewer.id || viewer.role === "admin";
  const thread = await getThread(Number(postId), { id: viewer.id, canManageClub });

  // RLS returns nothing for a thread in a category the viewer's tier does not
  // reach, so a locked thread and a missing one look the same here. Both 404.
  if (!thread || thread.clubSlug !== slug) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const membership = await getMyMembership(club.id, viewer.id);
  const canPost = canManageClub || membership.status === "approved";

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <NextLink href={`/clubs/${slug}/board`} style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {club.name} board
          </Typography>
        </Stack>
      </NextLink>

      {/* A rule in the club's colour, the category on it, then the title.
          Enough to place the thread on its board without repeating the whole
          masthead on every page. */}
      <Stack spacing={1} sx={{ mb: 3, pl: 2, borderLeft: `3px solid ${faction.base}` }}>
        <NextLink href={`/clubs/${slug}/board?category=${encodeURIComponent(thread.category)}`}
          style={{ textDecoration: "none" }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                            letterSpacing: "0.14em", color: faction.deep, fontWeight: 700,
                            "&:hover": { textDecoration: "underline" } }}>
            {thread.category.toUpperCase()}
          </Typography>
        </NextLink>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.7rem", md: "2.2rem" }, lineHeight: 1.15 }}>
          {thread.title}
        </Typography>
      </Stack>

      {/* A removed thread only reaches its author and the club, so this
          explains what happened rather than 404ing on a URL they may have had
          open, or followed from an email. */}
      {thread.removed ? (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: { xs: 3, sm: 4 },
                   backgroundColor: tokens.surface, textAlign: "center" }}>
          <DeleteOutlineIcon sx={{ fontSize: 30, color: tokens.inkMuted, mb: 1 }} />
          <Typography variant="h3" sx={{ fontSize: "1.2rem", mb: 0.75 }}>
            {thread.removed.byMe ? "You deleted this thread" : "This thread was removed"}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, maxWidth: 440, mx: "auto" }}>
            {thread.removed.byMe
              ? "It is gone from the board. Nobody else can see it, including its replies."
              : `${club.name} took this thread down. Nobody else can see it now. If you think that was a mistake, message the club.`}
          </Typography>
        </Box>
      ) : (
        <ThreadView thread={thread} slug={slug} faction={faction} canPost={canPost}
          viewerName={viewer.full_name || "You"} />
      )}
    </Container>
  );
}
