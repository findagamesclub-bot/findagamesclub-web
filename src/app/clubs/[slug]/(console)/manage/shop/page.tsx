import { notFound, redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import OrderQueue from "@/components/shop/OrderQueue";
import SectionPulse from "@/components/console/SectionPulse";
import ShopEditor from "./ShopEditor";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { findEditableShop } from "@/repositories/shopEditor.repository";
import { getOrders } from "@/services/clubExtras.service";
import { londonToday } from "@/services/bookingCalendar.service";
import { countByMonth } from "@/utils/club-pulse";
import { clubIdentity } from "@/utils/club-identity";

export const metadata = { title: "Shop" };

/** What the club sells, and how many of each size are left. */
export default async function ManageShopPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/shop">) {
  const { slug } = await params;
  const { tab } = await searchParams;
  // Items first: the orders tab carries its own count, and a club that has
  // nothing to answer should not land on an empty queue.
  const showing = tab === "orders" ? "orders" : "items";

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/shop`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("shop.manage")) notFound();

  const [items, orders] = await Promise.all([
    findEditableShop(club.id).catch(() => []),
    getOrders(club.id).catch(() => []),
  ]);
  const { faction } = clubIdentity(club.slug, club.name);

  const waiting = orders.filter((order) => order.status === "placed").length;
  const months = countByMonth(orders.map((order) => order.createdAt), londonToday());
  const at = (name: string) => `/clubs/${slug}/manage/shop?tab=${name}`;
  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Shop"
        lede="What you sell, in the sizes you sell it, and the orders waiting on you."
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Shop"
          value={showing}
          accent={faction.base}
          tabs={[
            { value: "items", label: "Items", href: at("items"), count: items.length },
            { value: "orders", label: "Orders", href: at("orders"), count: waiting },
          ]}
        />
      </Box>

      {showing === "orders" ? (
        <>
          <OrderQueue orders={orders} slug={slug} faction={faction} />

          {/* Two orders waiting is fine in a month with thirty and a disaster
              in a month with two, and the queue above cannot say which. */}
          <Box sx={{ mt: 3 }}>
            <SectionPulse
              label="Orders over the year"
              labels={months.map((m) => m.label)}
              series={[{ name: "Orders placed", color: faction.base,
                         values: months.map((m) => m.value) }]}
              note={`${orders.length} in the last year · ${waiting} still to answer`}
            />
          </Box>
        </>
      ) : (
        <ShopEditor slug={slug} clubId={club.id} items={items} faction={faction}
          tiers={club.membershipTiers.map((tier) => ({ key: tier.key, label: tier.label }))} />
      )}
    </Container>
  );
}
