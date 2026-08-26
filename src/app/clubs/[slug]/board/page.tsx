import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import BoardMasthead from "@/components/board/BoardMasthead";
import PostCard from "@/components/board/PostCard";
import NewPostForm from "@/components/board/NewPostForm";
import CategoryFilter from "@/components/board/CategoryFilter";
import EmptyState from "@/components/ui/EmptyState";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getBoard } from "@/services/discussions.service";
import { categoryOptions, tierRank } from "@/utils/discussion-categories";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/board">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Board — ${club.name}` : "Club not found" };
}

export default async function ClubBoardPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/board">) {
  const { slug } = await params;
  const query = await searchParams;
  const category = Array.isArray(query.category) ? query.category[0] : query.category;

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/board`);

  const { faction, monogram } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);
  const canManageClub = club.ownerId === viewer.id || viewer.role === "admin";
  const membership = await getMyMembership(club.id, viewer.id);
  const isMember = canManageClub || membership.status === "approved";

  const options = categoryOptions({
    categories: club.discussionCategories,
    tiers: club.membershipTiers.map((t) => ({ label: t.label, reserved: t.reservedCategories })),
    viewerRank: tierRank(club.membershipTiers, membership.tierKey),
    canManageClub,
  });

  // Not a member: the board is closed, and saying so beats an empty list that
  // reads as a club with nothing to say.
  if (!isMember) {
    return (
      <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
        <BoardMasthead back={back} clubName={club.name} clubSlug={club.slug} faction={faction}
          monogram={monogram} threads={0} replies={0} />
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 4, textAlign: "center" }}>
          <LockIcon sx={{ fontSize: 30, color: tokens.inkMuted, mb: 1 }} />
          <Typography variant="h3" sx={{ fontSize: "1.2rem", mb: 0.75 }}>
            The board is for members
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, maxWidth: 420, mx: "auto" }}>
            {membership.status === "pending"
              ? `Your request to join ${club.name} is with the owner. The board opens as soon as it is approved.`
              : `Join ${club.name} and you can read and post here.`}
          </Typography>
        </Box>
      </Container>
    );
  }

  const posts = await getBoard(club.id, { id: viewer.id, canManageClub }, category);
  const locked = options.filter((o) => o.lockedBy);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BoardMasthead back={back}
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        monogram={monogram}
        threads={posts.length}
        replies={posts.reduce((n, p) => n + p.replyCount, 0)}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <CategoryFilter options={options} active={category ?? null} slug={slug}
              faction={faction} />
          </Box>
          <Box sx={{ flexShrink: 0, pb: { sm: 0.75 } }}>
            <NewPostForm clubId={club.id} slug={slug} faction={faction} categories={options} />
          </Box>
        </Stack>
      </BoardMasthead>

      {posts.length === 0 ? (
        <EmptyState
          title={category ? `Nothing in ${category} yet` : "No threads yet"}
          description={
            category
              ? "Start one, or clear the filter to see the whole board."
              : "Be the first. Ask a question, show a model, or run a poll."
          }
          action={category ? { label: "Show every category", href: `/clubs/${slug}/board` } : undefined}
        />
      ) : (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                   backgroundColor: tokens.paper, overflow: "hidden" }}>
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} slug={slug} faction={faction} first={i === 0} />
          ))}
        </Box>
      )}

      {locked.length ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 3 }}>
          <LockIcon sx={{ fontSize: 15, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {locked.length === 1
              ? `${locked[0].label} is open to ${locked[0].lockedBy} members.`
              : `${locked.length} categories are open to higher tiers only.`}
          </Typography>
        </Stack>
      ) : null}
    </Container>
  );
}
