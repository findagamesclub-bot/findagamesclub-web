import { redirect } from "next/navigation";
import PageHead from "@/components/ui/PageHead";
import ProfileForm from "@/components/members/ProfileForm";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnDraft } from "@/services/profiles.service";

export const metadata = { title: "Edit your profile" };

/**
 * The same form the account area uses, landing back in the console.
 */
export default async function AdminEditProfilePage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=%2Fadmin%2Fprofile%2Fedit");

  const draft = await getOwnDraft(viewer.id);
  if (!draft) redirect("/auth/sign-in");

  return (
    <>
      <PageHead
        title="Your profile"
        lede="What members see when you write to them or they open your name. Everything is optional except your name."
      />
      <ProfileForm draft={draft} done="/admin/profile" />
    </>
  );
}
