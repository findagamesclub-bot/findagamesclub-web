import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import LoyaltySettingsForm from "./LoyaltySettingsForm";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { findLoyaltySettings } from "@/repositories/clubSettings.repository";

export const metadata = { title: "Loyalty" };

export default async function ManageLoyaltyPage({
  params,
}: PageProps<"/clubs/[slug]/manage/loyalty">) {
  const { slug } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/loyalty`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("members.manage")) notFound();

  const settings = await findLoyaltySettings(club.id).catch(() => null);
  const milestones = (settings?.milestones ?? {}) as Record<string, number>;

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Loyalty"
        lede="Whether members collect points, and what earns them."
      />
      <LoyaltySettingsForm
        slug={slug}
        enabled={Boolean(settings?.enabled)}
        pointValue={settings?.point_value === null || settings?.point_value === undefined
          ? "" : String(settings.point_value)}
        bookingPrice={settings?.table_booking_price ?? ""}
        milestones={milestones}
      />
    </Container>
  );
}
