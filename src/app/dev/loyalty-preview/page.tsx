import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import ClubStandings from "@/components/loyalty/ClubStandings";
import { clubIdentity } from "@/utils/club-identity";
import { DEFAULT_TIERS } from "@/utils/loyalty";

/**
 * Local-only view of the loyalty ladder.
 *
 * The board is members-only everywhere it really appears, so a squeezed row on
 * a phone could only be found by signing in — and it was the client who found
 * it. The names here are deliberately awkward: a long one, a single long word
 * with nowhere to break, and a short one, against the widest tier label a club
 * has invented.
 */
export default function LoyaltyPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const { faction } = clubIdentity("didcot-wargames-didcot", "Didcot Wargames");
  const tiers = [...DEFAULT_TIERS, { label: "Rock Star", pointsRequired: 2000, tone: "rainbow" }];

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h2" sx={{ fontSize: "1.4rem", mb: 2.5 }}>
        Loyalty ladder
      </Typography>
      <ClubStandings
        faction={faction}
        tiers={tiers}
        standings={[
          { profileId: "1", name: "Gulnabi Afridi", available: 383, lifetime: 1305 },
          { profileId: "2", name: "Bartholomew Fotheringay-Smythe", available: 12, lifetime: 2400 },
          { profileId: "3", name: "Constantinopolitanischer", available: 0, lifetime: 640 },
          { profileId: "4", name: "Jo", available: 5, lifetime: 120 },
          { profileId: "5", name: "Joe Matthews", available: 0, lifetime: 0 },
        ]}
      />
    </Container>
  );
}
