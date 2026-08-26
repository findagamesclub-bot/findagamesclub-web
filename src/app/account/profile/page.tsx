import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import ProfileForm from "@/components/members/ProfileForm";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnDraft } from "@/services/profiles.service";

export const metadata = { title: "Your profile" };

export default async function EditProfilePage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=%2Faccount%2Fprofile");

  const draft = await getOwnDraft(viewer.id);
  if (!draft) redirect("/auth/sign-in");

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <ProfileForm draft={draft} />
    </Container>
  );
}
