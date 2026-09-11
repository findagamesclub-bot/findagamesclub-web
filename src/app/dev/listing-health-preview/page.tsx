import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReviewStep from "@/components/listing/ReviewStep";
import { listingChecks, type ReadinessInput } from "@/utils/listing-readiness";

/**
 * Local-only view of the listing health report.
 *
 * The review step is four clicks inside a console only an owner can open, so
 * the two states that matter were only ever seen by signing in as one. A
 * finished listing and a half-filled one look very different here on purpose,
 * and the half-filled one is where the layout has to work hardest.
 */
export default function ListingHealthPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const finished: ReadinessInput = {
    name: "Didcot Wargames", city: "Didcot", formats: ["Wargaming"],
    summary: "A friendly club", description: "Long description here",
    venueName: "North Moreton Village Hall", postcode: "OX11 9AT",
    venueAddress: "High Street", website: "https://example.com",
    contactEmail: "hello@example.com",
    ages: "18+", memberCount: 148, tablesAvailable: 10,
    featuredGames: ["Warhammer 40,000"], facilities: ["Parking"], paymentMethods: ["Cash"],
    basicMembershipPriced: true, loyaltyReady: true,
    sessions: [{ day: "Thursday", time: "18:30 - 22:30", label: "Club session" }],
  };

  // One box short in three places, which is the case the old checklist told
  // somebody nothing useful about.
  const halfway: ReadinessInput = {
    name: "Mana Wharf Social Club", city: "London", formats: ["Board games"],
    summary: "", description: "",
    venueName: "The Wharf", postcode: "SE1 2AA", venueAddress: "", website: "",
    contactEmail: "",
    ages: "All ages", memberCount: 40, tablesAvailable: null,
    featuredGames: ["Catan"], facilities: [], paymentMethods: ["Cash"],
    basicMembershipPriced: true, loyaltyReady: false,
    sessions: [],
  };

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={5}>
        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>Finished listing</Typography>
          <ReviewStep checks={listingChecks(finished)}
            base="/clubs/didcot-wargames-didcot/manage/listing"
            clubSlug="didcot-wargames-didcot" />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>Half-filled listing</Typography>
          <ReviewStep checks={listingChecks(halfway)}
            base="/clubs/mana-wharf-social-club-london/manage/listing"
            clubSlug="mana-wharf-social-club-london" />
        </Stack>
      </Stack>
    </Container>
  );
}
