import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import ArmyListActions from "@/components/army/ArmyListActions";
import ArmyWizard from "@/components/army/ArmyWizard";
import ArmyLines from "@/components/army/ArmyLines";
import ArmyGateNote from "../ArmyGateNote";
import { getArmyGate } from "@/services/armyAccess.service";
import { getList } from "@/services/armyLists.service";
import { mono, tokens } from "@/lib/tokens";
import Typography from "@mui/material/Typography";

export async function generateMetadata(
  { params }: PageProps<"/clubs/[slug]/army-builder/[listId]">,
) {
  const { slug, listId } = await params;
  const gate = await getArmyGate(slug);
  const held = gate ? await getList(Number(listId), gate.viewer?.id ?? "") : null;
  return { title: held ? held.list.name : "List not found" };
}

/**
 * One list: the wizard when it is yours, a read-only sheet when it is not.
 *
 * Both come from the same page because they answer the same question, and
 * because a clubmate's list opening in something that looks like an editor
 * with everything greyed out is worse than a page that never offered.
 */
export default async function ArmyListPage(
  { params }: PageProps<"/clubs/[slug]/army-builder/[listId]">,
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
  const { list } = held;
  const current = list.current;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Crumbs items={[
          { label: gate.club.name, href: `/clubs/${slug}` },
          { label: "Army builder", href: `/clubs/${slug}/army-builder` },
          { label: list.name },
        ]} />
        <PageHead
          title={list.name}
          lede={[
            list.factionLabel,
            current?.detachments.map((d) =>
              [d.detachment, d.disposition].filter(Boolean).join(" · ")).join(", "),
            list.listType === "collection"
              ? `${current?.totalPoints ?? 0} points on the shelf`
              : `${current?.totalPoints ?? 0} of ${list.pointsLimit} points`,
          ].filter(Boolean).join(" — ").replace(" — ", ". ")}
          action={
            <ArmyListActions slug={slug} listId={list.id}
              versions={list.versionCount} canEdit={list.isOwner} />
          } />

        {list.isOwner ? (
          <ArmyWizard slug={slug} catalogue={gate.build?.catalogue ?? null}
            start={{
              listId: list.id, name: list.name, listType: list.listType,
              pointsLimit: list.pointsLimit, factionId: current?.factionId ?? "",
              detachments: current?.detachments ?? [],
              units: (current?.units ?? []).map((one) => ({
                unitName: one.unitName, optionLabel: one.optionLabel,
                quantity: one.quantity,
              })),
            }} />
        ) : (
          <Stack spacing={1.5}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                              color: tokens.inkMuted }}>
              {`Built by a clubmate · v${current?.versionNumber ?? 1} · `
                + `against catalogue ${current?.catalogueVersion ?? "unknown"}`}
            </Typography>
            <ArmyLines lines={current?.units ?? []} readOnly />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
