import { redirect } from "next/navigation";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { tokens } from "@/lib/tokens";
import PageHead from "@/components/ui/PageHead";
import EmptyState from "@/components/ui/EmptyState";
import ListingList from "@/components/listing/ListingList";
import StartListingButton from "@/components/listing/StartListingButton";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyListings } from "@/services/submissions.service";
import { getOwnerInbox } from "@/services/ownerInbox.service";

export const metadata = { title: "Your club requests" };

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

  // Cheap: the inbox is already built for the rail's own counts, and this
  // only decides whether to draw one sentence.
  const [listings, runsClubs] = await Promise.all([
    getMyListings(viewer.id),
    getOwnerInbox(viewer.id).then((clubs) => clubs.length > 0).catch(() => false),
  ]);
  const live = listings.filter((card) => card.status !== "cancelled");

  return (
    <>
      <PageHead
        title="Your club requests"
        lede="Clubs you have asked us to put in the directory, and how far each one got. You can have more than one on the go."
      />

      {/* The other half of the client's question, said on the page rather than
          left to be worked out from two different counts. Only what YOU sent
          in is here, so a club an admin set up and handed over, or one you
          help run for somebody else, is on My clubs and was never a request.
          Drawn only for somebody who runs one, because for everybody else
          there is no second list to be confused by. */}
      {runsClubs ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 3, maxWidth: 720 }}>
          {"Only the ones you sent in yourself. A club somebody handed you to run, "}
          {"or one you help run, is on "}
          <NextLink href="/my-clubs" style={{ color: tokens.brand }}>My clubs</NextLink>
          {" instead, and will not have a request here."}
        </Typography>
      ) : null}

      {live.length ? (
        <Stack spacing={2.5}>
          <ListingList cards={live} />
          <StartListingButton label="List another club" />
        </Stack>
      ) : (
        <EmptyState
          title="You have not asked us to list a club yet"
          description="Five steps and it is in the directory. Everything saves as you go, so you can stop and come back. Clubs you already run are on My clubs, whether or not the request came from you."
          action={{ label: "List your club", href: "/list-your-club" }}
        />
      )}
    </>
  );
}
