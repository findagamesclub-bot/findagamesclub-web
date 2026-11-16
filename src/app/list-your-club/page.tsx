import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import GroupsIcon from "@mui/icons-material/Groups";
import EventIcon from "@mui/icons-material/EventAvailable";
import StorefrontIcon from "@mui/icons-material/Storefront";
import InsightsIcon from "@mui/icons-material/Insights";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LinkButton from "@/components/ui/LinkButton";
import StartListingButton from "@/components/listing/StartListingButton";
import { FROM_LIST_YOUR_CLUB } from "@/utils/back-link";
import ListingList from "@/components/listing/ListingList";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyListings } from "@/services/submissions.service";
import { getPublicPrices } from "@/services/billing.service";
import { listingCostLine } from "@/utils/listing-billing";
import { mono, tokens } from "@/lib/tokens";

export const metadata = {
  title: "List your club",
  description:
    "Put your gaming club in the directory. Take bookings, run events, sell tickets and keep your members in one place.",
};

/** How many listings this page shows before it hands over to the full list. */
const SHOW_HERE = 3;

/**
 * What a club owner gets, in the client's own six boxes.
 *
 * Their words, kept. Four shorter ones were here and the ask was explicit:
 * "expand these boxes out and add further ones to describe all the features
 * and benefits a club owner can get from using the site", with the six
 * written out to replace them.
 *
 * Three small repairs and nothing else: "as well Warhammer" was missing its
 * second "as", the Team sentence had its object and its verb the wrong way
 * round, and "Club Directory" is sentence case like the other five and like
 * every other heading on the site.
 *
 * The order is theirs and it is a club's own order: get found, get members,
 * run the events, sell the kit, read the numbers, hand some of it over. It
 * would pair into neater rows sorted by length, which is a reason to reorder
 * a list only if nobody is reading it.
 */
const WHAT_YOU_GET = [
  { icon: TravelExploreIcon, title: "Club directory",
    body: "Create your club listing to be searchable within our directory, "
      + "promoting your club, location, games played, gaming schedules, "
      + "facilities, contact info, events you run, competitions/leagues and more." },
  { icon: GroupsIcon, title: "Members",
    body: "Manage your club members, memberships, tiers, benefits and membership "
      + "renewals. Create loyalty tiers, awards and member badges. Provide your "
      + "members with community features such as member profiles and messaging, "
      + "online table bookings and find an opponent requests, club discussion "
      + "boards, activity feeds, competitions and leagues setup, army builder, "
      + "game results and score tracking, AI coaching, rivalry tracking and more." },
  { icon: EventIcon, title: "Events and tickets",
    body: "Run a tournament or event end to end, from tournament advertising and "
      + "ticket sales, who is coming, the draw, round and game results, placings, "
      + "to recording and managing payments and the admin on the day." },
  { icon: StorefrontIcon, title: "Shop and coaching",
    body: "Advertise and sell club kit and merchandise, and take coaching or "
      + "other types of specialist bookings." },
  { icon: InsightsIcon, title: "Analytics",
    body: "Rich analytics are provided to show the growth of your club members "
      + "and revenue over time, what is selling and which club schedules are most "
      + "popular, as well as Warhammer 40k specific features to track the Meta at "
      + "your club by faction, detachments and dispositions." },
  { icon: AdminPanelSettingsIcon, title: "Team",
    body: "Give other team members who help run your club access to specific "
      + "admin privileges of the club owner tools." },
];

/**
 * The way in for somebody who does not have a club here yet.
 *
 * Three states on one page, because they are the same question asked of three
 * people: a visitor who needs an account, somebody signed in who has not
 * started, and somebody part way through. A separate page per state would mean
 * a redirect chain to work out which one they are.
 */
export default async function ListYourClubPage() {
  const [viewer, billing] = await Promise.all([
    getCurrentProfile(),
    // This page sells listing a club, so it has to say what that costs rather
    // than keep promising it is free after charging is switched on.
    getPublicPrices(),
  ]);
  // Cancelled ones are history and would be three cards of nothing to do.
  const mine = viewer
    ? (await getMyListings(viewer.id).catch(() => []))
        .filter((card) => card.status !== "cancelled")
    : [];
  const resume = mine[0] ?? null;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <Stack spacing={{ xs: 4, md: 6 }}>
        <Stack spacing={2} sx={{ maxWidth: 680 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                            letterSpacing: "0.14em", color: tokens.brass }}>
            FOR CLUB ORGANISERS
          </Typography>

          <Typography variant="h1" sx={{ fontSize: { xs: "2.1rem", md: "3rem" }, lineHeight: 1.08 }}>
            Put your club where players are looking
          </Typography>

          <Typography variant="body1" sx={{ color: tokens.inkMuted, fontSize: "1.05rem" }}>
            Five steps and you are in the directory. {listingCostLine(billing)} You
            keep control of everything on your page, and you can stop halfway and
            come back to it. Most clubs finish in about twenty minutes.
          </Typography>

          {resume ? null : viewer ? (
            <Stack direction="row" spacing={1.5} sx={{ pt: 1, flexWrap: "wrap" }} useFlexGap>
              <StartListingButton from={FROM_LIST_YOUR_CLUB} />
              <LinkButton href="/clubs" variant="outlined">See how clubs look</LinkButton>
            </Stack>
          ) : (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }} useFlexGap>
                <LinkButton href="/auth/sign-up?next=/list-your-club" variant="contained" size="large">
                  Create an account to start
                </LinkButton>
                <LinkButton href="/clubs" variant="outlined">See how clubs look</LinkButton>
              </Stack>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Already have one?{" "}
                <NextLink href="/auth/sign-in?next=/list-your-club"
                  style={{ color: tokens.brand, fontWeight: 600 }}>
                  Sign in
                </NextLink>
                {" "}and pick up from there.
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* Outside the reading column above, which is 680px wide because that is
            a comfortable measure for prose and a terrible one for a grid of
            cards. The ones on the go, and the way past them: a listing in
            progress used to hide the start button entirely, so somebody who
            runs one club and wants to add a second had nowhere to go.

            Three at most. This page is a prompt, not a list: somebody with six
            gets the newest three and a way to the rest, rather than six cards
            where they came to press one button. */}
        {resume ? (
          <Stack spacing={2}>
            <ListingList cards={mine} limit={SHOW_HERE} from={FROM_LIST_YOUR_CLUB} />
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }} useFlexGap>
              <StartListingButton label="List a different club" variant="outlined"
                from={FROM_LIST_YOUR_CLUB} />
              {mine.length > SHOW_HERE ? (
                <LinkButton href="/account/listings" variant="text">
                  {`See all ${mine.length} of your listings`}
                </LinkButton>
              ) : null}
            </Stack>
          </Stack>
        ) : null}

        {/* Six boxes of close prose, so they get a heading. Four short ones
            could sit under the buttons and read as captions; this many cannot,
            and a reader meeting them cold has no idea what the list is of. */}
        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.3rem" }}>What you get</Typography>

          {/* Three across where there is room, two in the middle, one on a
              phone. Two across at full width puts about ninety characters on a
              line, which is half as long again as anything should be; three
              brings it back to about fifty-five. Each row stretches to its
              tallest card, so the edges line up however unevenly the client's
              six paragraphs run. */}
          <Box sx={{ display: "grid", gap: 2,
                     gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                            sm: "repeat(2, minmax(0, 1fr))",
                                            lg: "repeat(3, minmax(0, 1fr))" } }}>
            {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
              <Stack key={title} spacing={1}
                sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                      backgroundColor: tokens.paper }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Icon aria-hidden sx={{ fontSize: 18, color: tokens.brass }} />
                  <Typography variant="h4" sx={{ fontSize: "1rem" }}>{title}</Typography>
                </Stack>
                <Typography variant="body2"
                  sx={{ color: tokens.inkMuted, lineHeight: 1.65 }}>
                  {body}
                </Typography>
              </Stack>
            ))}
          </Box>
        </Stack>

        {/* The control again, at the bottom. Somebody who has read this far is
            the person who is convinced, and sending them back to the top to act
            on it is the page making them work for it. */}
        <Stack spacing={2} sx={{ maxWidth: 680 }}>
          <Stack spacing={1}>
            <Typography variant="h2" sx={{ fontSize: "1.3rem" }}>What happens next</Typography>
            {/* The free path and the paid one are different stories, and this
                told the free one either way: with charging on, nobody reads a
                listing until it is paid for. */}
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {billing.enabled
                ? "You fill in the five steps and send it to us. We email you how "
                  + "to pay, and once the first payment is in somebody reads it. If "
                  + "anything is missing we send it back with a note rather than "
                  + "turning it down. Once it is approved your page goes live and "
                  + "the club console is yours."
                : "You fill in the five steps, send it to us, and somebody reads it. "
                  + "If anything is missing we send it back with a note rather than "
                  + "turning it down. Once it is approved your page goes live and "
                  + "the club console is yours."}
            </Typography>
          </Stack>

          {resume ? null : viewer ? (
            <StartListingButton from={FROM_LIST_YOUR_CLUB} />
          ) : (
            <LinkButton href="/auth/sign-up?next=/list-your-club" variant="contained" size="large"
              sx={{ alignSelf: "flex-start" }}>
              Create an account to start
            </LinkButton>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
