import { redirect } from "next/navigation";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import ArmyListBoard from "@/components/army/ArmyListBoard";
import EmptyState from "@/components/ui/EmptyState";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyLists } from "@/services/armyLists.service";

export const metadata = { title: "Your armies" };

/**
 * Every list somebody owns, across every club.
 *
 * The club builders are each a view of one club's shelf; this is the person's
 * own. Somebody who plays the same army at two clubs has it twice, deliberately
 * so, because the club is what gates it and what it was priced against.
 */
export default async function AccountArmiesPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=%2Faccount%2Farmies");

  // The club's slug rides along on the read rather than costing a second one.
  const lists = await getMyLists(viewer.id).catch(() => []);

  return (
    <Stack spacing={3}>
      <PageHead title="Your armies"
        lede="Every list you have built, at every club you belong to." />

      {lists.length ? (
        <ArmyListBoard lists={lists} showClub />
      ) : (
        <EmptyState title="No lists yet"
          description="Open a club that runs the army builder and build one. It will show up here whichever club you built it at." />
      )}
    </Stack>
  );
}
