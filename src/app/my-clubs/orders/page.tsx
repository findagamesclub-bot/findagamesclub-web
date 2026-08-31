import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/account/PageHead";
import BackLink from "@/components/ui/BackLink";
import OwnerOrders from "@/components/owner/OwnerOrders";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnedOrders } from "@/services/ownerBookings.service";
import { countUnanswered } from "@/utils/club-order-filter";
import { getOwnerInbox } from "@/services/ownerInbox.service";

export const metadata = { title: "All merchandise orders" };

/**
 * Every merchandise order across every club this person owns.
 *
 * Answering one still happens on the club's own shop page, where the order log
 * and the status control are. This answers "is anybody waiting on me for kit",
 * which four shop pages cannot.
 */
export default async function OwnerOrdersPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/my-clubs/orders");

  const clubs = await getOwnerInbox(viewer.id);
  if (!clubs.length) redirect("/my-clubs");

  const orders = await getOwnedOrders(viewer.id);
  const waiting = countUnanswered(orders);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <BackLink href="/my-clubs" label="My clubs" />
      <PageHead
        title="Merchandise orders"
        lede={waiting
          ? `${waiting} ${waiting === 1 ? "order is" : "orders are"} waiting on you, across ${
              clubs.length === 1 ? "your club" : `${clubs.length} clubs`}.`
          : "Every order placed at your clubs' shops."}
      />
      <OwnerOrders orders={orders} />
    </Container>
  );
}
