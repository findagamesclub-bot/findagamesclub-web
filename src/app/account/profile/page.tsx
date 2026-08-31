import { redirect } from "next/navigation";
import PageHead from "@/components/account/PageHead";
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
    <>
      <PageHead
        title="Tell people what you play"
        lede="Other members see this when you post or ask for a game. Everything is optional except your name."
      />
      <ProfileForm draft={draft} />
    </>
  );
}
