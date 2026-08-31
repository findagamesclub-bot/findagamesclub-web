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
import BoardSearch from "@/components/board/BoardSearch";
import Pager from "@/components/ui/Pager";
import EmptyState from "@/components/ui/EmptyState";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { BOARD_PAGE_SIZE, getBoard } from "@/services/discussions.service";
import { categoryOptions, tierRank } from "@/utils/discussion-categories";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/board">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Board · ${club.name}` : "Club not found" };
}

export default async function ClubBoardPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/board">) {
  const { slug } = await params;
  const query = await searchParams;
  const category = Array.isArray(query.category) ? query.category[0] : query.category;
  const search = Array.isArray(query.q) ? query.q[0] : query.q;
  const page = Math.max(1, Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1);

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

  const board = await getBoard(club.id, { id: viewer.id, canManageClub },
    { category, search, page });
  const { posts } = board;

  // Keeps whatever the reader is already filtering by when they turn the page.
  const pageHref = (to: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("q", search);
    if (to > 1) params.set("page", String(to));
    const q = params.toString();
    return `/clubs/${slug}/board${q ? `?${q}` : ""}`;
  };

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BoardMasthead back={back}
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        monogram={monogram}
        threads={board.total}
        replies={posts.reduce((n, p) => n + p.replyCount, 0)}
      >
        {/* Top-aligned: the categories wrap now, so bottom-aligning dropped the
            button level with the last row instead of the first. */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <CategoryFilter options={options} active={category ?? null} slug={slug}
              faction={faction} search={search ?? null} />
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <NewPostForm clubId={club.id} slug={slug} faction={faction} categories={options}
              profileId={viewer.id} />
          </Box>
        </Stack>
      </BoardMasthead>

      <Box sx={{ maxWidth: 420, mb: 2 }}>
        <BoardSearch slug={slug} category={category ?? null} initial={search ?? ""} />
      </Box>

      {search ? (
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                          letterSpacing: "0.08em", color: tokens.inkMuted, mb: 1.5 }}>
          {board.total === 1 ? "1 THREAD MATCHES" : `${board.total} THREADS MATCH`}
          {` "${search.toUpperCase()}"`}
        </Typography>
      ) : null}

      {posts.length === 0 ? (
        <EmptyState
          title={
            search
              ? `Nothing matches "${search}"`
              : category ? `Nothing in ${category} yet` : "No threads yet"
          }
          description={
            search
              ? "Try a shorter word, or clear the search to see the whole board."
              : category
                ? "Start one, or clear the filter to see the whole board."
                : "Be the first. Ask a question, show a model, or run a poll."
          }
          action={category || search
            ? { label: "Show every thread", href: `/clubs/${slug}/board` }
            : undefined}
        />
      ) : (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                   backgroundColor: tokens.paper, overflow: "hidden" }}>
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} slug={slug} faction={faction} first={i === 0} />
          ))}
        </Box>
      )}

      <Box sx={{ mt: 2.5 }}>
        <Pager page={board.page} total={board.total} noun="threads"
          size={BOARD_PAGE_SIZE} hrefFor={pageHref} />
      </Box>

    </Container>
  );
}
