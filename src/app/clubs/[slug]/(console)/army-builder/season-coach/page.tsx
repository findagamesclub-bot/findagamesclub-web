import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import SeasonCoach from "@/components/ai/SeasonCoach";
import { getArmyGate, aiGateFor } from "@/services/armyAccess.service";
import { getClubLists } from "@/services/armyLists.service";
import { getUsage } from "@/services/aiJobs.service";

export const metadata = { title: "Season coach" };

/**
 * A plan for the season, from the games the club has confirmed.
 *
 * Staleness is worked out here rather than stored: three confirmed games since
 * it was written, or twenty-one days, whichever comes first
 * (`SEASON_COACH_STALE_*`, club_store.py:214). A stored flag would have to be
 * kept in step by something, and nothing would.
 */
export default async function SeasonCoachPage(
  { params }: PageProps<"/clubs/[slug]/army-builder/season-coach">,
) {
  const { slug } = await params;
  const gate = await getArmyGate(slug);
  if (!gate) notFound();

  const reason = aiGateFor(gate, "season");
  const viewerId = gate.viewer?.id ?? "";

  const [usage, lists] = reason
    ? [{ message: "", limited: false }, []]
    : await Promise.all([
        getUsage(gate.club.id, "season"),
        getClubLists(gate.club.id, viewerId).catch(() => []),
      ]);

  // Staleness belongs to the plan on file rather than to a run, and the plan
  // is keyed on a focus the reader has not chosen yet. Left to the component,
  // which knows which list and goal are in front of it.
  const stale = "";

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder", href: `/clubs/${slug}/army-builder` },
          { label: "Season coach" },
        ]} />
        <PageHead title="Season coach"
          lede="A few weeks of practical work, built from the games this club has confirmed and the goal you pick. Only settled results count." />
        <SeasonCoach slug={slug}
          lists={lists.filter((one) => one.isOwner && one.current)
            .map((one) => ({ id: one.id, name: one.name, faction: one.factionLabel }))}
          reason={reason} usage={usage} initial={null} stale={stale} />
      </Stack>
    </Container>
  );
}
