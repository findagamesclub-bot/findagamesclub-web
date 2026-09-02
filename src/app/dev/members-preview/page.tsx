import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import MemberCard from "@/components/members/MemberCard";
import MemberAdmin from "@/components/members/MemberAdmin";
import type { MembershipTier } from "@/types/clubDetail";
import PendingRow from "@/components/members/PendingRow";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";
import type { ClubMember } from "@/types/membership";

/** Local-only view of the members screens with a populated roster. */
export default function MembersPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");

  const make = (i: number, name: string, games: string[], armies: string[], years: number): ClubMember => ({
    membershipId: i,
    profileId: String(i),
    fullName: name,
    status: "approved",
    tierKey: i % 3 === 0 ? "premium-membership" : "basic",
    tierAssignedAt: null,
    joinedAt: new Date(Date.now() - years * 365 * 86_400_000).toISOString(),
    requestedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    games,
    armies,
    playStyle: [],
    tenureYears: years,
  });

  const tiers: MembershipTier[] = [
    { key: "basic", label: "Basic Membership", price: "£10", priceDuration: "month",
      description: null, isBasic: true, isFree: false, benefits: [], benefitGroups: [], benefitValues: {}, eventDiscountPercent: 0, reservedCategories: [],
      billingOptions: [
        { id: "basic-month", label: "Monthly", price: "£10", cadence: "month" },
        { id: "basic-year", label: "Yearly", price: "£100", cadence: "year" },
        { id: "basic-one-off", label: "One-off", price: "£300", cadence: "one-off" },
      ] },
    { key: "premium-membership", label: "Premium Membership", price: "£15", priceDuration: "month",
      description: null, isBasic: false, isFree: false, benefits: [], benefitGroups: [], benefitValues: {}, eventDiscountPercent: 10, reservedCategories: [],
      billingOptions: [{ id: "premium-membership-month", label: "Monthly", price: "£15", cadence: "month" }] },
  ];

  const day = 86_400_000;
  const samplePayments = [
    { id: 2, tierKey: "basic", tierLabel: "Basic Membership", billingOptionLabel: "Monthly", price: "£10",
      priceDuration: "month", periodStart: new Date(Date.now() - 10 * day).toISOString(),
      periodEnd: new Date(Date.now() + 20 * day).toISOString(), note: "Bank transfer",
      recordedAt: new Date(Date.now() - 10 * day).toISOString() },
    { id: 1, tierKey: "basic", tierLabel: "Basic Membership", billingOptionLabel: "Monthly", price: "£10",
      priceDuration: "month", periodStart: new Date(Date.now() - 40 * day).toISOString(),
      periodEnd: new Date(Date.now() - 10 * day).toISOString(), note: "Cash at the door",
      recordedAt: new Date(Date.now() - 40 * day).toISOString() },
  ];
  const standings = [
    { paidThrough: new Date(Date.now() + 20 * day).toISOString(), overdue: false, settledOneOff: false },
    { paidThrough: null, overdue: false, settledOneOff: false },
    { paidThrough: new Date(Date.now() - 9 * day).toISOString(), overdue: true, settledOneOff: false },
    { paidThrough: null, overdue: false, settledOneOff: true },
    { paidThrough: new Date(Date.now() + 200 * day).toISOString(), overdue: false, settledOneOff: false },
    { paidThrough: null, overdue: false, settledOneOff: false },
  ];

  const roster = [
    make(1, "Gulnabi Afridi", ["Warhammer 40,000", "Kill Team"], ["Death Guard"], 0),
    make(2, "Joe Matthews", ["Age of Sigmar"], ["Stormcast Eternals"], 4),
    make(3, "Priya Raman", ["Warhammer 40,000", "Horus Heresy"], ["Iron Warriors", "Salamanders"], 2),
    make(4, "Tom Whitfield", ["Star Wars: Legion"], [], 1),
    make(5, "Aisha Bello", ["Kill Team", "Shatterpoint"], ["Hive Fleet Kraken"], 0),
    make(6, "Dan Okafor", [], [], 3),
  ];
  const pending = [
    { ...make(7, "Marcus Bell", ["Warhammer 40,000"], ["Necrons"], 0), status: "pending" as const, joinedAt: null },
    { ...make(8, "Ellie Nash", ["Age of Sigmar", "Kill Team"], [], 0), status: "pending" as const, joinedAt: null },
  ];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader
        clubName="Didcot Wargames"
        clubSlug="didcot-wargames-didcot"
        faction={faction}
        note="Didcot Wargames lists 40 members in total. This page shows the 6 who have joined through FindAGamesClub."
        stats={[
          { label: "joined here", value: "6" },
          { label: "waiting", value: "2", emphasis: true },
          { label: "longest, years", value: "4" },
        ]}
      />

      <Box sx={{ border: `1px solid ${tokens.brass}`, borderRadius: 2, bgcolor: tokens.brassSoft,
                 p: { xs: 2, md: 2.5 }, mb: 4 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 1.5 }}
            sx={{ alignItems: { sm: "baseline" }, mb: 2 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.12em",
                            color: "#5c4310", fontWeight: 600 }}>
            WAITING FOR YOU
          </Typography>
          <Typography variant="body2" sx={{ color: "#5c4310" }}>2 people have asked to join.</Typography>
        </Stack>
        <Stack spacing={1.5}>
          {pending.map((m) => (
            <PendingRow
                key={m.membershipId}
                member={m}
                faction={faction}
                slug="didcot-wargames-didcot"
                tierLabel={m.tierKey === "premium-membership" ? "Premium Membership" : "Basic Membership"}
                askedLabel="3 days ago"
              />
          ))}
        </Stack>
      </Box>

      <Box sx={{ display: "grid", gap: 2,
                 gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" } }}>
        {roster.map((m, i) => (
          <MemberCard key={m.membershipId} member={m} faction={faction}
            tierLabel={m.tierKey === "premium-membership" ? "Premium Membership" : null}
            action={
              <MemberAdmin
                membershipId={m.membershipId}
                slug="didcot-wargames-didcot"
                memberName={m.fullName}
                tierKey={m.tierKey}
                tiers={tiers}
                standing={standings[i]!}
                payments={i === 0 ? samplePayments : []}
                faction={faction}
              />
            }
          />
        ))}
      </Box>
    </Container>
  );
}
