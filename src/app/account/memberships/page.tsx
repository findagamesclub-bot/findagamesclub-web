import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/account/PageHead";
import MembershipBrowser from "@/components/account/MembershipBrowser";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyMemberships } from "@/services/myMemberships.service";

export const metadata = { title: "Your memberships" };

export default async function MembershipsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/memberships");

  const memberships = await getMyMemberships(viewer.id);
  const owing = memberships.filter(
    (m) => m.status === "approved" && m.standing.overdue,
  ).length;

  return (
    <>
      <PageHead
        title="Memberships"
        lede={owing
          ? `${owing === 1 ? "One club is" : `${owing} clubs are`} waiting on a payment from you.`
          : "Which clubs you belong to, what tier you are on, and what you have paid."}
      />

      {memberships.length ? (
        <MembershipBrowser memberships={memberships} />
      ) : (
        <EmptyState
          title="You have not joined a club yet"
          description="Ask to join from any club page. The club decides, and you will see the answer here."
          action={{ label: "Find a club", href: "/clubs" }}
        />
      )}
    </>
  );
}
