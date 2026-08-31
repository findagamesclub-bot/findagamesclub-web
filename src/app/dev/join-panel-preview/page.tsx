import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import JoinClubPanel from "@/components/members/JoinClubPanel";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";
import type { MembershipTier } from "@/types/clubDetail";

/** Local-only view of every state the join panel can be in. */
export default function JoinPanelPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");
  const tiers: MembershipTier[] = [
    { key: "basic", label: "Basic Membership", price: "£10", priceDuration: "month",
      description: null, isBasic: true, benefits: [], benefitGroups: [], benefitValues: {}, eventDiscountPercent: 0, reservedCategories: [],
      billingOptions: [{ id: "basic-month", label: "Monthly", price: "£10", cadence: "month" }] },
    { key: "premium-membership", label: "Premium Membership", price: "£15", priceDuration: "month",
      description: null, isBasic: false, benefits: [], benefitGroups: [], benefitValues: {}, eventDiscountPercent: 10, reservedCategories: [],
      billingOptions: [{ id: "premium-membership-month", label: "Monthly", price: "£15", cadence: "month" }] },
  ];

  const unpaid = { paidThrough: null, overdue: false, settledOneOff: false };
  const day = 86_400_000;
  const samplePayments = [
    { id: 2, tierKey: "basic", tierLabel: "Basic Membership", billingOptionLabel: "Monthly",
      price: "£10", priceDuration: "month",
      periodStart: new Date(Date.now() - 10 * day).toISOString(),
      periodEnd: new Date(Date.now() + 20 * day).toISOString(),
      note: "Bank transfer", recordedAt: new Date(Date.now() - 10 * day).toISOString() },
    { id: 1, tierKey: "basic", tierLabel: "Basic Membership", billingOptionLabel: "Monthly",
      price: "£10", priceDuration: "month",
      periodStart: new Date(Date.now() - 40 * day).toISOString(),
      periodEnd: new Date(Date.now() - 10 * day).toISOString(),
      note: "Cash at the door", recordedAt: new Date(Date.now() - 40 * day).toISOString() },
  ];
  const base = {
    clubId: 9, slug: "didcot-wargames-didcot", clubName: "Didcot Wargames",
    faction, tiers, memberCount: 12, standing: unpaid, payments: [], takesBookings: true, hasLoyalty: true, hasShop: true, hasCoaching: true,
  };

  const states = [
    { title: "Signed out", props: { ...base, signedIn: false, canManage: false, pendingCount: null,
        membership: { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null } } },
    { title: "Signed in, not a member", props: { ...base, signedIn: true, canManage: false, pendingCount: null,
        membership: { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null } } },
    { title: "Request pending", props: { ...base, signedIn: true, canManage: false, pendingCount: null,
        membership: { id: 1, status: "pending" as const, tierKey: "premium-membership", tierAssignedAt: null } } },
    { title: "Approved member, paid up", props: { ...base, signedIn: true, canManage: false, pendingCount: null,
        membership: { id: 1, status: "approved" as const, tierKey: "basic", tierAssignedAt: null },
        payments: samplePayments,
        standing: { paidThrough: new Date(Date.now() + 60 * 86_400_000).toISOString(),
                    overdue: false, settledOneOff: false } } },
    { title: "Approved member, lapsed", props: { ...base, signedIn: true, canManage: false, pendingCount: null,
        membership: { id: 1, status: "approved" as const, tierKey: "premium-membership", tierAssignedAt: null },
        payments: samplePayments,
        standing: { paidThrough: new Date(Date.now() - 12 * 86_400_000).toISOString(),
                    overdue: true, settledOneOff: false } } },
    { title: "Club owner", props: { ...base, signedIn: true, canManage: true, pendingCount: 2,
        membership: { id: null, status: "none" as const, tierKey: null, tierAssignedAt: null } } },
    { title: "Previously declined", props: { ...base, signedIn: true, canManage: false, pendingCount: null,
        membership: { id: 1, status: "cancelled" as const, tierKey: null, tierAssignedAt: null,
          declineReason: "We are at capacity until September." } } },
  ];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: 5 }}>
      <Typography variant="h1" sx={{ fontSize: "2rem", mb: 3 }}>Join panel states</Typography>
      <Box sx={{ display: "grid", gap: 3,
                 gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(3,1fr)" } }}>
        {states.map((s) => (
          <Box key={s.title}>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.1em",
                              color: tokens.inkMuted, mb: 1 }}>
              {s.title.toUpperCase()}
            </Typography>
            <JoinClubPanel {...s.props} />
          </Box>
        ))}
      </Box>
    </Container>
  );
}
