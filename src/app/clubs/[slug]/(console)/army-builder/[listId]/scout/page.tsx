import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import ScoutPicker from "@/components/ai/ScoutPicker";
import { getArmyGate, aiGateFor } from "@/services/armyAccess.service";
import { getList } from "@/services/armyLists.service";
import { getUsage } from "@/services/aiJobs.service";
import { getRoster } from "@/services/memberships.service";

export const metadata = { title: "Scout an opponent" };

/**
 * A briefing on one clubmate.
 *
 * The roster is the list of who can be scouted, because the evidence is the
 * club's own confirmed results. Yourself excluded, for the obvious reason.
 */
export default async function ScoutPage(
  { params }: PageProps<"/clubs/[slug]/army-builder/[listId]/scout">,
) {
  const { slug, listId } = await params;
  const gate = await getArmyGate(slug);
  if (!gate) notFound();

  const held = await getList(Number(listId), gate.viewer?.id ?? "");
  if (!held?.list?.isOwner || !held.list.current) notFound();

  const reason = aiGateFor(gate, "scouting");
  const [usage, roster] = reason
    ? [{ message: "", limited: false, remaining: null }, []]
    : await Promise.all([
        getUsage(gate.club.id, "scouting"),
        getRoster(gate.club.id).catch(() => []),
      ]);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder", href: `/clubs/${slug}/army-builder` },
          { label: held.list.name, href: `/clubs/${slug}/army-builder/${listId}` },
          { label: "Scouting" },
        ]} />
        <PageHead title="Scout an opponent"
          lede="What a clubmate tends to bring, how you have done against them, and where the openings have been." />
        <ScoutPicker slug={slug} listId={held.list.id}
          clubmates={roster
            .filter((one) => one.status === "approved" && one.profileId !== gate.viewer?.id)
            .map((one) => ({ id: one.profileId, name: one.fullName }))}
          reason={reason} usage={usage} initial={null} />
      </Stack>
    </Container>
  );
}
