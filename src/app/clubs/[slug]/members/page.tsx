import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import LockIcon from "@mui/icons-material/Lock";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import Button from "@mui/material/Button";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import MemberCard from "@/components/members/MemberCard";
import PendingRow from "@/components/members/PendingRow";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership, getPendingRequests, getRoster } from "@/services/memberships.service";
import { getClubPayments, standing } from "@/services/payments.service";
import { getRivals } from "@/services/clubExtras.service";
import { getProgramme, getStandings } from "@/services/loyalty.service";
import { tierFor } from "@/utils/loyalty";
import RivalButton from "@/components/rivals/RivalButton";
import MemberAdmin from "@/components/members/MemberAdmin";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { sinceLabel } from "@/utils/dates";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({
  params,
}: PageProps<"/clubs/[slug]/members">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Members — ${club.name}` : "Club not found" };
}

export default async function ClubMembersPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/members">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const { faction } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);
  const viewer = await getCurrentProfile();
  const canManage = Boolean(viewer && (club.ownerId === viewer.id || viewer.role === "admin"));

  const membership = viewer
    ? await getMyMembership(club.id, viewer.id)
    : { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null };

  // Both queries are policy-protected and would return empty rather than error,
  // but an empty roster and a hidden roster have to read differently.
  const canSeeRoster = canManage || membership.status === "approved";
  const [roster, pendingRequests, payments] = await Promise.all([
    canSeeRoster ? getRoster(club.id) : Promise.resolve([]),
    canManage ? getPendingRequests(club.id) : Promise.resolve([]),
    // Payments are policy-scoped to the member or the club's manager, so this
    // is fetched once for the whole roster rather than per card.
    canSeeRoster ? getClubPayments(club.id) : Promise.resolve(new Map()),
  ]);

  // Rivalries hang off the roster, so they are loaded with it rather than on a
  // page of their own — you name a rival while looking at the list of people.
  const rivals = viewer && canSeeRoster ? await getRivals(club.id, viewer.id, roster) : [];
  const rivalRowOf = new Map(rivals.map((r) => [r.personId, r]));

  // Standings sit on the roster so an owner can see at a glance who is close to
  // a reward, instead of reading the roster and the points page side by side.
  const programme = canSeeRoster ? await getProgramme(club.id) : null;
  const standings = programme ? await getStandings(club.id) : [];
  const pointsOf = new Map(standings.map((s) => [s.profileId, s]));

  const loyaltyFor = (profileId: string) => {
    if (!programme) return null;
    const held = pointsOf.get(profileId);
    const standing = tierFor(held?.lifetime ?? 0, programme.tiers);
    return {
      tier: standing.tier?.label ?? "Bronze",
      tone: standing.tier?.tone ?? "bronze",
      lifetime: held?.lifetime ?? 0,
      available: held?.available ?? 0,
      toNext: standing.toNext,
      nextTier: standing.next?.label ?? null,
      progress: standing.progress,
      entries: held?.entries ?? [],
    };
  };

  const tierLabel = (key: string | null) =>
    key ? (club.membershipTiers.find((t) => t.key === key)?.label ?? null) : null;

  const longest = roster.reduce((n, m) => Math.max(n, m.tenureYears), 0);
  const stats = [
    { label: roster.length === 1 ? "joined here" : "joined here", value: String(roster.length) },
    ...(canManage && pendingRequests.length
      ? [{ label: "waiting", value: String(pendingRequests.length), emphasis: true }]
      : []),
    ...(longest >= 1 ? [{ label: "longest, years", value: String(longest) }] : []),
  ];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={back}
        clubName={club.name}
        clubSlug={club.slug}
        faction={faction}
        stats={canSeeRoster ? stats : []}
        // The club's own figure and the roster count are different numbers,
        // both true: one is how big the club is, the other is who has an
        // account here. Saying so is better than picking one and hoping.
        note={
          canSeeRoster && club.memberCount && club.memberCount > roster.length
            ? `${club.name} lists ${club.memberCount} members in total. This page shows the ${roster.length === 1 ? "one who has" : `${roster.length} who have`} joined through FindAGamesClub.`
            : null
        }
      />

      {canManage && pendingRequests.length ? (
        <Box
          sx={{
            border: `1px solid ${tokens.brass}`,
            borderRadius: 2,
            bgcolor: tokens.brassSoft,
            p: { xs: 2, md: 2.5 },
            mb: 4,
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.5 }}
            sx={{ alignItems: { sm: "baseline" }, mb: 2 }}>
            <Typography
              sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.12em",
                    color: "#5c4310", fontWeight: 600 }}
            >
              WAITING FOR YOU
            </Typography>
            <Typography variant="body2" sx={{ color: "#5c4310" }}>
              {pendingRequests.length === 1
                ? "One person has asked to join."
                : `${pendingRequests.length} people have asked to join.`}
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            {pendingRequests.map((m) => (
              <PendingRow
                key={m.membershipId}
                member={m}
                faction={faction}
                slug={club.slug}
                tierLabel={tierLabel(m.tierKey)}
                askedLabel={sinceLabel(m.requestedAt)}
              />
            ))}
          </Stack>
        </Box>
      ) : null}

      {!canSeeRoster ? (
        <Stack spacing={1.5} sx={{ alignItems: "flex-start", border: `1px solid ${tokens.rule}`,
                                   borderRadius: 2, p: { xs: 2.5, md: 4 }, bgcolor: tokens.paper }}>
          <LockIcon sx={{ color: tokens.inkMuted, fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>
            {club.name} shows its member list to members only.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {membership.status === "pending"
              ? "Your request is with the club. You will see the roster once they approve it."
              : "Ask to join from the club page and you will see who plays here once the club approves you."}
          </Typography>

          {/* Owner notification emails arrive at the club's address, which is
              often not the account the browser is signed in to. Without this
              the page just looks broken to whoever opened the link. */}
          {viewer ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Signed in as <strong>{viewer.email}</strong>.{" "}
              <NextLink href="/auth/sign-out" style={{ color: tokens.brand }}>
                Sign in as someone else
              </NextLink>
            </Typography>
          ) : (
            <NextLink href={`/auth/sign-in?next=/clubs/${club.slug}/members`} style={{ textDecoration: "none" }}>
              <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                Sign in
              </Typography>
            </NextLink>
          )}
        </Stack>
      ) : roster.length ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {roster.map((m) => (
            <MemberCard
              key={m.membershipId}
              member={m}
              faction={faction}
              tierLabel={tierLabel(m.tierKey)}
              loyalty={loyaltyFor(m.profileId)}
              action={
                // The club's controls take the slot when there are any;
                // otherwise it is the way to open a conversation.
                canManage ? (
                  <MemberAdmin
                    membershipId={m.membershipId}
                    slug={club.slug}
                    memberName={m.fullName}
                    tierKey={m.tierKey}
                    tiers={club.membershipTiers}
                    standing={standing(payments.get(m.membershipId) ?? [], m.tierKey, m.tierAssignedAt)}
                    payments={payments.get(m.membershipId) ?? []}
                    faction={faction}
                  />
                ) : m.profileId !== viewer?.id && viewer ? (
                  // Wrapped, not `component={NextLink}`: this is a Server
                  // Component, and MUI's `component` prop cannot cross that line.
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                    <NextLink href={`/messages/${club.id}/${m.profileId}`}
                      style={{ textDecoration: "none" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 15 }} />}
                        sx={{ borderColor: tokens.rule, color: tokens.inkMuted,
                              "&:hover": { borderColor: faction.base, color: faction.deep } }}
                      >
                        Message
                      </Button>
                    </NextLink>
                    <RivalButton
                      clubId={club.id}
                      slug={club.slug}
                      personId={m.profileId}
                      personName={m.fullName}
                      rivalRowId={rivalRowOf.get(m.profileId)?.id ?? null}
                      mutual={Boolean(rivalRowOf.get(m.profileId)?.mutual)}
                      faction={faction}
                    />
                  </Stack>
                ) : undefined
              }
            />
          ))}
        </Box>
      ) : (
        <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                                 p: { xs: 3, md: 5 }, textAlign: "center", bgcolor: tokens.paper }}>
          <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>Nobody has joined yet</Typography>
          <Typography variant="body2" color="text.secondary">
            Approved members appear here with the games and armies from their profile.
          </Typography>
        </Stack>
      )}
    </Container>
  );
}
