import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import GroupsIcon from "@mui/icons-material/Groups";
import EventIcon from "@mui/icons-material/EventAvailable";
import StorefrontIcon from "@mui/icons-material/Storefront";
import InsightsIcon from "@mui/icons-material/Insights";
import LinkButton from "@/components/ui/LinkButton";
import StartListingButton from "@/components/listing/StartListingButton";
import ListingList from "@/components/listing/ListingList";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyListings } from "@/services/submissions.service";
import { mono, tokens } from "@/lib/tokens";

export const metadata = {
  title: "List your club",
  description:
    "Put your gaming club in the directory. Take bookings, run events, sell tickets and keep your members in one place.",
};

/** How many listings this page shows before it hands over to the full list. */
const SHOW_HERE = 3;

const WHAT_YOU_GET = [
  { icon: GroupsIcon, title: "Members and nights",
    body: "A page people can find, a membership list you control, and table bookings that cannot double-book." },
  { icon: EventIcon, title: "Events and tickets",
    body: "Run a tournament end to end: tickets, the draw, who is coming, and the door list on the day." },
  { icon: StorefrontIcon, title: "A shop and coaching",
    body: "Sell club kit in sizes, take coaching bookings, and hand out loyalty points for turning up." },
  { icon: InsightsIcon, title: "Something to show for it",
    body: "See what is selling, who is lapsing and which nights fill, without exporting anything." },
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
  const viewer = await getCurrentProfile();
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
            Five steps and you are in the directory. It is free to list, you keep
            control of everything on your page, and you can stop halfway and come
            back to it. Most clubs finish in about twenty minutes.
          </Typography>

          {resume ? null : viewer ? (
            <Stack direction="row" spacing={1.5} sx={{ pt: 1, flexWrap: "wrap" }} useFlexGap>
              <StartListingButton />
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
            <ListingList cards={mine} limit={SHOW_HERE} />
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }} useFlexGap>
              <StartListingButton label="List a different club" variant="outlined" />
              {mine.length > SHOW_HERE ? (
                <LinkButton href="/account/listings" variant="text">
                  {`See all ${mine.length} of your listings`}
                </LinkButton>
              ) : null}
            </Stack>
          </Stack>
        ) : null}

        <Box sx={{ display: "grid", gap: 2,
                   gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
          {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
            <Stack key={title} spacing={1}
              sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                    backgroundColor: tokens.paper }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Icon aria-hidden sx={{ fontSize: 18, color: tokens.brass }} />
                <Typography variant="h4" sx={{ fontSize: "1rem" }}>{title}</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{body}</Typography>
            </Stack>
          ))}
        </Box>

        {/* The control again, at the bottom. Somebody who has read this far is
            the person who is convinced, and sending them back to the top to act
            on it is the page making them work for it. */}
        <Stack spacing={2} sx={{ maxWidth: 680 }}>
          <Stack spacing={1}>
            <Typography variant="h2" sx={{ fontSize: "1.3rem" }}>What happens next</Typography>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              You fill in the five steps, send it to us, and somebody reads it. If
              anything is missing we send it back with a note rather than turning it
              down. Once it is approved your page goes live and the club console is
              yours.
            </Typography>
          </Stack>

          {resume ? null : viewer ? (
            <StartListingButton />
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
