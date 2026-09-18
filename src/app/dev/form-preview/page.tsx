import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ProfileForm from "@/components/members/ProfileForm";
import ButtonStates from "@/components/ui/ButtonStates";

/** Local-only, so the form layout can be looked at without signing in. */
export default function FormPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={2} sx={{ mb: 5 }}>
        <Typography variant="h2" sx={{ fontSize: "1.4rem" }}>
          Buttons while they work
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Press one. It works for a second and a half, which is long enough to
          read. The label must hold still, the spinner must replace the start
          icon, and the label must be legible against whatever the button sits on.
        </Typography>
        <ButtonStates />
      </Stack>

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
