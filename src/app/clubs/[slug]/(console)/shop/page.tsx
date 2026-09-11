import { notFound, redirect } from "next/navigation";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import ClubSectionHeader from "@/components/clubs/ClubSectionHeader";
import ClubShop from "@/components/shop/ClubShop";
import { getClubDetail } from "@/services/clubDetail.service";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getMyMembership } from "@/services/memberships.service";
import { getOrders, getShop, getShopStanding } from "@/services/clubExtras.service";
import { clubIdentity } from "@/utils/club-identity";
import { backTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export async function generateMetadata({
  params,
}: PageProps<"/clubs/[slug]/shop">) {
  const { slug } = await params;
  const club = await getClubDetail(slug);
  return { title: club ? `Merchandise · ${club.name}` : "Club not found" };
}

export default async function ShopPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/shop">) {
  const { slug } = await params;
  const query = await searchParams;
  const club = await getClubDetail(slug);
  if (!club) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/shop`);

  const { faction, monogram } = clubIdentity(club.slug, club.name);
  const back = backTarget(query.from, club);
  const access = await getClubAccess(club.id, viewer);
  const canManage = access.can("shop.manage");
  const membership = await getMyMembership(club.id, viewer.id);

  const [items, orders, standing] = await Promise.all([
    getShop({
      clubId: club.id,
      tiers: club.membershipTiers,
      canManageClub: canManage,
      signedIn: true,
      isApprovedMember: membership.status === "approved",
      viewerTierKey: membership.tierKey,
    }),
    canManage ? getOrders(club.id) : Promise.resolve([]),
    getShopStanding(club.id, viewer.id, club.membershipTiers),
  ]);

  // A club with nothing for sale has no shop, rather than an empty one.
  if (!items.length && !canManage) notFound();

  const waiting = orders.filter((o) => o.status === "placed").length;

  const unanswered = orders.filter((o) => o.status === "placed").length;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <ClubSectionHeader back={back} title="Merchandise" clubName={club.name} clubSlug={club.slug}
        faction={faction}
        stats={[
          { label: items.length === 1 ? "item" : "items", value: String(items.length) },
          ...(canManage && waiting
            ? [{ label: "waiting on you", value: String(waiting), emphasis: true }]
            : []),
        ]} />

      {/* The one thing the shop cannot answer: what you already ordered.
          Members were finding this page and then hunting for their own orders. */}
      <Box sx={{ mb: 2.5 }}>
        <NextLink href="/account/orders" style={{ textDecoration: "none" }}>
          <Typography variant="body2"
            sx={{ color: faction.deep, fontWeight: 600,
                  "&:hover": { textDecoration: "underline" } }}>
            Your merchandise orders
          </Typography>
        </NextLink>
      </Box>

      {items.length ? (
        <ClubShop items={items} faction={faction} monogram={monogram} slug={slug}
          clubId={club.id} profileId={viewer.id} standing={standing} />
      ) : (
        <Box sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 1.5, p: 4,
                   textAlign: "center" }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Nothing listed yet. Add what the club sells from Shop in the console.
          </Typography>
        </Box>
      )}

      {/* The queue moved into the console, beside the items it is about. This
          page is where members buy; answering an order is the club's work and
          belongs with the rest of it. */}
      {canManage && unanswered ? (
        <Box sx={{ mt: 4 }}>
          <NextLink href={`/clubs/${slug}/manage/shop?tab=orders`}
            style={{ textDecoration: "none" }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              {unanswered === 1
                ? "One order is waiting on you \u203a"
                : `${unanswered} orders are waiting on you \u203a`}
            </Typography>
          </NextLink>
        </Box>
      ) : null}
    </Container>
  );
}
