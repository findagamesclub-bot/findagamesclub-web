import { redirect } from "next/navigation";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import EmptyState from "@/components/ui/EmptyState";
import ListingList from "@/components/listing/ListingList";
import StartListingButton from "@/components/listing/StartListingButton";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyListings } from "@/services/submissions.service";

export const metadata = { title: "Your club listings" };

/**
 * Every club this person has tried to list.
 *
 * The card on /account and on /list-your-club can only point at one listing,
 * which is right for the common case and wrong for somebody who runs a club
 * already: they are the likeliest person to list a second, and a card showing
 * the first was standing in the way of it. This is where all of them live, with
 * the one action each state allows.
 *
 * Not paged. Nobody lists fifty clubs, and the SQL-paged treatment the admin
 * queue gets would be machinery for a list that is almost always one row.
 */
export default async function AccountListingsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/listings");

  const listings = await getMyListings(viewer.id);
  const live = listings.filter((card) => card.status !== "cancelled");

  return (
    <>
      <PageHead
        title="Your club listings"
        lede="Clubs you have put forward, and where each one got to. You can have more than one on the go."
      />

      {live.length ? (
        <Stack spacing={2.5}>
          <ListingList cards={live} />
          <StartListingButton label="List another club" />
        </Stack>
      ) : (
        <EmptyState
          title="You have not listed a club yet"
          description="Five steps and it is in the directory. Everything saves as you go, so you can stop and come back."
          action={{ label: "List your club", href: "/list-your-club" }}
        />
      )}
    </>
  );
}
