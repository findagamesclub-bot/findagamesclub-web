import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import OpponentPicker from "@/components/ai/OpponentPicker";
import { getArmyGate, aiGateFor } from "@/services/armyAccess.service";
import { getList } from "@/services/armyLists.service";
import { getUsage } from "@/services/aiJobs.service";
import { factionsIn } from "@/utils/army-catalogue";

export const metadata = { title: "Match-up" };

/**
 * One list against one faction.
 *
 * Its own page rather than a dialog on the list, because a briefing is
 * something somebody reads for a few minutes the night before a game, and rule
 * 5's dialog is for editing rather than for reading at length.
 */
export default async function MatchupPage(
  { params }: PageProps<"/clubs/[slug]/army-builder/[listId]/matchup">,
) {
  const { slug, listId } = await params;
  const gate = await getArmyGate(slug);
  if (!gate) notFound();

  const held = await getList(Number(listId), gate.viewer?.id ?? "");
  if (!held?.list?.isOwner || !held.list.current) notFound();

  const reason = aiGateFor(gate, "matchup");
  const [usage] = reason
    ? [{ message: "", limited: false, remaining: null }]
    : await Promise.all([
        getUsage(gate.club.id, "matchup"),
      ]);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder", href: `/clubs/${slug}/army-builder` },
          { label: held.list.name, href: `/clubs/${slug}/army-builder/${listId}` },
          { label: "Match-up" },
        ]} />
        <PageHead title="Match-up"
          lede={`How ${held.list.name} reads against another faction, from the two unit mixes and nothing else.`} />
        <OpponentPicker feature="matchup" slug={slug} listId={held.list.id}
          factions={factionsIn(gate.build?.catalogue ?? null)
            .map((one) => ({ id: one.id, label: one.label }))}
          reason={reason} usage={usage} initial={null} />
      </Stack>
    </Container>
  );
}
