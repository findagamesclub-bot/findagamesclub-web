import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import LinkButton from "@/components/ui/LinkButton";
import Crumbs from "@/components/ui/Crumbs";
import AddIcon from "@mui/icons-material/Add";
import ArmyListBoard from "@/components/army/ArmyListBoard";
import ArmyGateNote from "./ArmyGateNote";
import { getArmyGate } from "@/services/armyAccess.service";
import { getClubLists } from "@/services/armyLists.service";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]/army-builder">) {
  const { slug } = await params;
  const gate = await getArmyGate(slug);
  return { title: gate ? `Army builder at ${gate.club.name}` : "Not found" };
}

/**
 * The shelf at one club.
 *
 * Yours and your clubmates' together, which is legacy's own visibility
 * (`list_visible_army_lists`, club_store.py:6811) and is what makes scouting
 * somebody before Thursday possible at all. Only the owner can change one.
 */
export default async function ArmyBuilderPage(
  { params }: PageProps<"/clubs/[slug]/army-builder">,
) {
  const { slug } = await params;
  const gate = await getArmyGate(slug);
  if (!gate) notFound();

  const lists = gate.reason
    ? []
    : await getClubLists(gate.club.id, gate.viewer?.id ?? "").catch(() => []);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        {/* The console rail is only drawn for the club's own team, so a member
            reading their lists has nothing else to navigate by. */}
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder" },
        ]} />
        <PageHead
          title="Army builder"
          lede={`Lists built against ${gate.club.name}'s catalogue. Yours first, then your clubmates'.`}
          action={gate.reason ? undefined : (
            <LinkButton variant="contained" startIcon={<AddIcon />}
              href={`/clubs/${slug}/army-builder/new`}>
              New list
            </LinkButton>
          )} />

        {gate.reason ? (
          <ArmyGateNote reason={gate.reason} />
        ) : (
          <ArmyListBoard lists={lists} basePath={`/clubs/${slug}/army-builder`} />
        )}
      </Stack>
    </Container>
  );
}
