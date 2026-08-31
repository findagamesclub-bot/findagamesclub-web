import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/account/PageHead";
import OrderBrowser from "@/components/account/OrderBrowser";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyOrders } from "@/services/myActivity.service";

export const metadata = { title: "Your merchandise" };

/**
 * Merchandise this member has ordered, at any club.
 *
 * Clubs hand orders over in person, so the question this page answers is
 * whether the club still has yours or you have already taken it home.
 */
export default async function AccountOrdersPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/orders");

  const orders = await getMyOrders(viewer.id);

  return (
    <>
      <PageHead
        title="Merchandise"
        // Deliberately not the waiting count: OrderBrowser says that directly
        // below with a button attached, and the same sentence twice in a row
        // reads as a rendering bug.
        lede="Everything you have ordered from your clubs' shops."
      />

      {orders.length ? (
        <OrderBrowser orders={orders} />
      ) : (
        <EmptyState
          title="No orders yet"
          description="Some clubs sell shirts, dice and terrain to members. Their shop is on the club page."
          action={{ label: "Your clubs", href: "/account/memberships" }}
        />
      )}
    </>
  );
}
