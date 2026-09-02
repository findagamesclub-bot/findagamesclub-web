import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HistoryIcon from "@mui/icons-material/History";
import GroupsIcon from "@mui/icons-material/Groups";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import Section from "@/components/ui/Section";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import LoyaltyPanel from "@/components/loyalty/LoyaltyPanel";
import LoyaltyLedger from "@/components/loyalty/LoyaltyLedger";
import ClubStandings from "@/components/loyalty/ClubStandings";
import TierLadder from "@/components/loyalty/TierLadder";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMembership } from "@/services/memberships.service";
import { getProgramme, getStandings, getWallet } from "@/services/loyalty.service";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({
  params,
}: PageProps<"/clubs/[slug]/loyalty">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Loyalty · ${club.name}` : "Club not found" };
}

export default async function LoyaltyPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/loyalty">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const programme = await getProgramme(club.id);
  // A club that runs no programme has no page, rather than an empty one.
  if (!programme) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/loyalty`);

  const { faction } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);
  const canManage = club.ownerId === viewer.id || viewer.role === "admin";
  const membership = await getMyMembership(club.id, viewer.id);
  const wallet = await getWallet(club.id, viewer.id);

  // An owner runs the programme rather than earning from it, so the club's
  // standings are what this page means to them. Sending them the member's
  // empty-wallet prompt told a club owner to join their own club.
  const standings = canManage ? await getStandings(club.id) : [];

  // Which kinds of earning this member has actually collected, so the rate card
  // can distinguish "you have done this" from "you could".
  const earnedCategories = new Set((wallet?.entries ?? []).map((e) => e.category));
  const anniversaryYears = new Set(
    (wallet?.entries ?? [])
      .filter((e) => e.category === "anniversary")
      .map((e) => Number(e.description.match(/^(\d+)-year/)?.[1] ?? 0)),
  );

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      {/* No figures here: the panel below carries them, and the same number in
          two places reads as two different numbers that happen to agree. */}
      <ClubSectionHeader back={back} title="Loyalty" clubName={club.name} clubSlug={club.slug}
        faction={faction} stats={[]} />

      {canManage ? (
        <Section title="Where your members stand" icon={GroupsIcon}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2 }}>
            Points belong to each member individually, not to the club. This is every
            member of {club.name} and what they have earned here.
          </Typography>
          <ClubStandings standings={standings} tiers={programme.tiers} faction={faction} />
        </Section>
      ) : null}

      {wallet && membership.status === "approved" ? (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: { xs: 2, sm: 2.75 },
                   backgroundColor: tokens.paper, mb: 1 }}>
          <LoyaltyPanel wallet={wallet} />
        </Box>
      ) : canManage ? null : (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 3,
                   backgroundColor: tokens.paper, mb: 1 }}>
          <Typography variant="h3" sx={{ fontSize: "1.15rem", mb: 0.75 }}>
            Join {club.name} to start earning
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Points start the day your membership is approved, and build every time you
            book a table or take tickets for an event.
          </Typography>
        </Box>
      )}

      {/* Two columns from md up, and in this order on a phone.
          What a reader wants, in order: where am I, what can I reach, how do I
          get there, and only then what have I already done. The history is the
          longest of the four and the least urgent, so it moves out of the way
          rather than pushing the ladder below fifteen rows of it. */}
      <Box sx={{ display: "grid", gap: { xs: 0, md: 4 }, alignItems: "start",
                 gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) minmax(0,1fr)" } }}>
      <Box>
      <Section title="The ladder" icon={MilitaryTechIcon}>
        <TierLadder tiers={programme.tiers} lifetime={wallet?.lifetime ?? 0} />
      </Section>

      <Section title="Ways to earn" icon={EmojiEventsIcon}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 2 }}>
          What {club.name} pays for taking part. This is the club&rsquo;s rate card, not
          your history &mdash; the ones you have collected are ticked.
        </Typography>

        <Stack spacing={1}>
          {programme.milestones.map((m) => (
            <Earner key={m.label} label={m.label} points={m.points}
              earned={earnedCategories.has(m.category)} />
          ))}
          {programme.anniversaries.map((a) => (
            <Earner key={a.years} label={`${a.years} ${a.years === 1 ? "year" : "years"} a member`}
              points={a.points} earned={anniversaryYears.has(a.years)} />
          ))}
        </Stack>
      </Section>
      </Box>

      {wallet && membership.status === "approved" ? (
        <Section title="How it adds up" icon={HistoryIcon}>
          <LoyaltyLedger entries={wallet.entries} />
        </Section>
      ) : null}
      </Box>
    </Container>
  );
}

function Earner({ label, points, earned }: {
  label: string; points: number; earned: boolean;
}) {
  return (
    <Stack direction="row" spacing={2}
      sx={{ py: 1, alignItems: "center", justifyContent: "space-between",
            borderTop: `1px solid ${tokens.rule}` }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
        {earned ? (
          <CheckIcon sx={{ fontSize: 16, color: tokens.positive, flexShrink: 0 }} />
        ) : (
          // Holds the same width, so the labels line up whether ticked or not.
          <Box sx={{ width: 16, flexShrink: 0 }} />
        )}
        <Typography variant="body2"
          sx={{ color: earned ? tokens.ink : tokens.inkMuted }}>
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", fontWeight: 700,
                        color: earned ? tokens.positive : tokens.inkMuted, flexShrink: 0 }}>
        +{points}
      </Typography>
    </Stack>
  );
}
