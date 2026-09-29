import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import ArmyWizard from "@/components/army/ArmyWizard";
import ArmyGateNote from "../ArmyGateNote";
import { getArmyGate } from "@/services/armyAccess.service";

export const metadata = { title: "New army list" };

export default async function NewArmyListPage(
  { params }: PageProps<"/clubs/[slug]/army-builder/new">,
) {
  const { slug } = await params;
  const gate = await getArmyGate(slug);
  if (!gate) notFound();

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder", href: `/clubs/${slug}/army-builder` },
          { label: "New list" },
        ]} />
        <PageHead title="New army list"
          lede={`Four steps: what it is, the faction, its detachments, then the units. Priced against ${gate.club.name}'s catalogue as you go.`} />

        {gate.reason ? (
          <ArmyGateNote reason={gate.reason} />
        ) : (
          <ArmyWizard slug={slug} catalogue={gate.build?.catalogue ?? null}
            start={{
              listId: null, name: "", listType: "army-list", pointsLimit: "",
              factionId: "", detachments: [], units: [],
            }} />
        )}
      </Stack>
    </Container>
  );
}
