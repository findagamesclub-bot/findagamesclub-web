import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import ProfileForm from "@/components/members/ProfileForm";

/** Local-only, so the form layout can be looked at without signing in. */
export default function FormPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <ProfileForm
        draft={{
          fullName: "Gulnabi Afridi",
          bio: "Been painting Death Guard since 2019 and playing most Thursdays at Didcot.",
          homePostcode: "OX11 9AT",
          travelMiles: "30",
          games: ["Warhammer 40,000", "Kill Team"],
          armies: ["Death Guard", "Custodes"],
          availability: ["Tuesday", "Thursday", "Saturday"],
          ageGroups: ["18+"],
          socials: [],
  playStyle: ["Narrative", "Teaching newcomers"],
        }}
      />
    </Container>
  );
}
