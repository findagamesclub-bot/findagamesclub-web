import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import ArmyBuilderSettings from "@/components/clubs/ArmyBuilderSettings";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getBuilderFor } from "@/services/armyBuilder.service";
import { getEditions } from "@/services/armyCatalogue.service";

export const metadata = { title: "Army builder" };

/**
 * Whether this club runs the army builder.
 *
 * One switch, and everything army-shaped reads it: the result dialog's army
 * fields, the faction analytics, and the list builder in stage 10. A club that
 * plays board games sees exactly the dialog it saw before any of this existed.
 *
 * Deliberately not guessed from the club's game list. A club can list
 * Warhammer 40,000 and want nothing to do with a list builder, and a club that
 * does not list it today can add it next week.
 *
 * `listing.edit`, so an owner or a manager but not a helper: this decides what
 * every member sees, which is a listing decision rather than a night's work.
 */
export default async function ArmyBuilderPage({
  params,
}: PageProps<"/clubs/[slug]/manage/army-builder">) {
  const { slug } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/army-builder`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("listing.edit")) notFound();

  const [builder, editions] = await Promise.all([
    getBuilderFor(club.id),
    getEditions(),
  ]);

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Army settings"
        lede="Whether results at your club record what people played, and which catalogue they are recorded against. It is what the faction analytics, the meta tracker and the army builder all read. Leave it off and nothing changes."
      />
      <ArmyBuilderSettings
        slug={slug}
        enabled={builder.enabled}
        editionId={builder.editionId}
        editions={editions.filter((one) => one.status === "active")}
      />
    </Container>
  );
}
