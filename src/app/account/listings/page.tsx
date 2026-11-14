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
import { listingsVersusClubs } from "@/utils/listing-reconcile";

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

  // Cheap: the inbox is already built for the rail's own counts, and My clubs
  // reads exactly this, so the two pages cannot disagree about how many clubs
  // somebody runs. That matters here more than anywhere: the whole point of
  // the sentence below is that the two figures add up.
  const [listings, runs] = await Promise.all([
    getMyListings(viewer.id),
    getOwnerInbox(viewer.id).catch(() => []),
  ]);
  const live = listings.filter((card) => card.status !== "cancelled");

  // How many of the clubs they RUN began as a request on this page. Matched on
  // the club id a submission gets when it is approved, so a request still
  // waiting counts towards neither: it has no club yet.
  const asked = new Set(live.map((card) => card.clubId).filter(Boolean));
  const reconciled = listingsVersusClubs({
    runs: runs.length,
    fromHere: runs.filter((club) => asked.has(club.id)).length,
  });

  return (
    <>
      <PageHead
        title="Your club requests"
        lede="Clubs you have asked us to put in the directory, and how far each one got. You can have more than one on the go."
      />

      {/* The client's question, answered with the arithmetic rather than with
          prose. They counted this page against My clubs three times and asked
          why 4 against 8, so the page now does that sum itself and prints
          both figures. Prose alone was not enough, twice. */}
      {reconciled ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 3, maxWidth: 720 }}>
          {reconciled}{" "}
          <NextLink href="/my-clubs" style={{ color: tokens.brand }}>
            See My clubs
          </NextLink>
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
