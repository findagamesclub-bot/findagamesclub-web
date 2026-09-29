import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import ArmyVersionList from "@/components/army/ArmyVersionList";
import ArmyGateNote from "../../ArmyGateNote";
import { getArmyGate } from "@/services/armyAccess.service";
import { getList } from "@/services/armyLists.service";

export const metadata = { title: "List history" };

/**
 * Every version this list has had.
 *
 * A version happens when the army changes, never when the name does, so this
 * is a record of decisions rather than of saves. Restoring one is the ordinary
 * save path, which is why the history only ever grows.
 */
export default async function ArmyVersionsPage(
  { params }: PageProps<"/clubs/[slug]/army-builder/[listId]/versions">,
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
  if (!held?.list) notFound();

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder", href: `/clubs/${slug}/army-builder` },
          { label: held.list.name, href: `/clubs/${slug}/army-builder/${listId}` },
          { label: "History" },
        ]} />
        <PageHead title="List history"
          lede={`Every version of ${held.list.name}, newest first. Renaming it does not make one; changing the army does.`} />
        <ArmyVersionList slug={slug} listId={held.list.id}
          versions={held.versions} canEdit={held.list.isOwner} />
      </Stack>
    </Container>
  );
}
