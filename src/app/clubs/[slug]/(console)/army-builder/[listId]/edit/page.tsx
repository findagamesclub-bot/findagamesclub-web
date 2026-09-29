import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import ArmyWizard from "@/components/army/ArmyWizard";
import ArmyGateNote from "../../ArmyGateNote";
import { getArmyGate } from "@/services/armyAccess.service";
import { getList } from "@/services/armyLists.service";

export const metadata = { title: "Edit list" };

/**
 * The editor, on its own page.
 *
 * It used to be the list page itself, which meant opening a list to read its
 * coaching dropped somebody into a four-step form: the thing you came to read
 * was above the thing you did not come to do. Reading and editing are two
 * jobs, so they are two pages, and the list page is now the same sheet whether
 * it is yours or a clubmate's.
 */
export default async function EditListPage(
  { params }: PageProps<"/clubs/[slug]/army-builder/[listId]/edit">,
) {
  const { slug, listId } = await params;
  const gate = await getArmyGate(slug);
  if (!gate) notFound();
  if (gate.reason) {
    return (
      <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
        <ArmyGateNote reason={gate.reason} />
      </Container>
    );
  }

  const held = await getList(Number(listId), gate.viewer?.id ?? "");
  const current = held?.list?.current;
  if (!held?.list?.isOwner || !current) notFound();

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder", href: `/clubs/${slug}/army-builder` },
          { label: held.list.name, href: `/clubs/${slug}/army-builder/${listId}` },
          { label: "Edit" },
        ]} />
        <PageHead title={`Editing ${held.list.name}`}
          lede="Four steps: what it is, the faction, its detachments, then the units. Saving makes a version only when the army changes." />
        <ArmyWizard slug={slug} catalogue={gate.build?.catalogue ?? null}
          start={{
            listId: held.list.id, name: held.list.name,
            listType: held.list.listType, pointsLimit: held.list.pointsLimit,
            factionId: current.factionId, detachments: current.detachments,
            units: current.units.map((one) => ({
              unitName: one.unitName, optionLabel: one.optionLabel,
              quantity: one.quantity,
            })),
          }} />
      </Stack>
    </Container>
  );
}
