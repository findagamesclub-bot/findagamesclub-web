import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import ArmyListActions from "@/components/army/ArmyListActions";
import ArmyLines from "@/components/army/ArmyLines";
import ArmyGateNote from "../ArmyGateNote";
import { getArmyGate, aiGateFor } from "@/services/armyAccess.service";
import { getUsage, getLatest } from "@/services/aiJobs.service";
import { listHealth } from "@/utils/list-health";
import { dispositionsFor } from "@/utils/army-catalogue";
import Section from "@/components/ui/Section";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ListHealthCard from "@/components/ai/ListHealthCard";
import AiPanel from "@/components/ai/AiPanel";
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

  // The deterministic half runs on every open and costs nothing. The AI half
  // is three short reads and no model call: the gate, the allowance, and the
  // last answer if there is one.
  const health = current && listHealth({
    units: current.units,
    totalPoints: current.totalPoints,
    pointsLimit: Number(current.pointsLimit) || 0,
    detachments: current.detachments,
    dispositionsFor: (detachment) =>
      dispositionsFor(gate.build?.catalogue ?? null, current.factionId, detachment),
  });

  const coachReason = aiGateFor(gate, "coach");
  const [coachUsage, coachJob] = list.isOwner && !coachReason && current
    ? await Promise.all([
        getUsage(gate.club.id, "coach"),
        // The version is the coach's signature, so the report on file is
        // this list's and never the last list somebody opened.
        getLatest(gate.club.id, gate.viewer?.id ?? "", "coach", String(current!.id)),
      ])
    : [{ message: "", limited: false, remaining: null }, null];

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

        <Stack spacing={1.5}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                            color: tokens.inkMuted }}>
            {[list.isOwner ? "Yours" : "Built by a clubmate",
              `v${current?.versionNumber ?? 1}`,
              `against catalogue ${current?.catalogueVersion ?? "unknown"}`,
            ].join(" · ")}
          </Typography>
          <ArmyLines lines={current?.units ?? []} readOnly />
        </Stack>

        {list.isOwner && current && health ? (
          <Section navLabel="Coaching" title="List health and coaching"
            icon={AutoAwesomeIcon}
            note="What the shape of this list says, worked out here, and a written review on top of it.">
            <Stack spacing={3}>
              <ListHealthCard health={health} />
              <AiPanel feature="coach" slug={slug} listId={list.id}
                reason={coachReason} usage={coachUsage} initial={coachJob} />
            </Stack>
          </Section>
        ) : null}

      </Stack>
    </Container>
  );
}
