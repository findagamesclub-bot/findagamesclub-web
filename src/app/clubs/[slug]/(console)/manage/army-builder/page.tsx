import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import ArmyBuilderSettings from "@/components/clubs/ArmyBuilderSettings";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getBuilderFor } from "@/services/armyBuilder.service";
import { getEditions } from "@/services/armyCatalogue.service";
import { getClubSpend } from "@/services/aiJobs.service";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

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

  const [builder, editions, spentPence] = await Promise.all([
    getBuilderFor(club.id),
    getEditions(),
    // What the club has spent this month. Read whether or not the builder is
    // on, because a club that has just turned it off still has a bill.
    getClubSpend(club.id),
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

      {/* The bill, under the switch that causes it. Its own line rather than a
          panel: it is one number until a club is actually spending. */}
      <Stack spacing={0.5} sx={{ mt: 4, pt: 2.5, borderTop: `1px solid ${tokens.rule}` }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          AI THIS MONTH
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "1.5rem", fontWeight: 700,
                          color: tokens.brass }}>
          {`£${(spentPence / 100).toFixed(2)}`}
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Coaching, match-ups, scouting and season plans your members have run.
          A run that fails is not charged for.
        </Typography>
      </Stack>
    </Container>
  );
}
