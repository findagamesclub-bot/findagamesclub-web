"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LinkButton from "@/components/ui/LinkButton";
import { useActionToast } from "@/components/ui/Toaster";
import PointsBar from "./PointsBar";
import ArmyLines from "./ArmyLines";
import ArmyUnitPicker from "./ArmyUnitPicker";
import {
  StepDetails, StepFaction, StepDetachments, StepDisposition,
} from "./ArmySteps";
import { StepRail } from "./ArmyStepRail";
import { saveArmyList } from "@/app/clubs/[slug]/(console)/army-builder/actions";
import { useArmyDraft, type ArmyDraft } from "@/hooks/useArmyDraft";
import { refusalFor } from "@/utils/army-list";
import {
  dispositionsForAll,
} from "@/utils/army-catalogue";
import {
  heldDisposition, oneDisposition, withDisposition,
} from "@/utils/army-disposition";
import { factionsIn, pointsOptionsIn, type Catalogue } from "@/utils/army-catalogue";
import { tokens } from "@/lib/tokens";

export type WizardStart = ArmyDraft;

/**
 * Building a list, in five steps.
 *
 * Legacy's four, with the disposition lifted out of the detachment rows into
 * one of its own: the game allows one disposition for the whole army and a
 * picker per row allowed as many as you had detachments. What it writes is
 * unchanged, which `utils/army-disposition.ts` explains.
 *
 * The draft is held merged: one entry per unit and option, exactly what the
 * screen shows, so adding the same unit twice moves a number rather than
 * growing a second row. `normaliseLines` re-prices it on every keystroke,
 * which is cheap and is what keeps the points bar honest while scrolling.
 *
 * Nothing here is trusted. The same four jobs run again in SQL on the way in,
 * and the refusals are legacy's own sentences from one tested place, so the
 * message the bar shows and the message the database raises are the same
 * words.
 */
export default function ArmyWizard({
  slug, start, catalogue,
}: {
  slug: string;
  start: WizardStart;
  catalogue: Catalogue | null;
}) {
  const router = useRouter();
  const [busy, startSaving] = useTransition();
  const [state, setState] = useState<{ error?: string; notice?: string }>({});
  useActionToast(state);

  const [step, setStep] = useState(1);
  const [changing, setChanging] = useState<{ id: string; label: string } | null>(null);
  const { draft, units, priced, held, patch, addUnit, setQuantity, setFaction } =
    useArmyDraft(start, catalogue);

  const factions = factionsIn(catalogue);
  const pointsOptions = pointsOptionsIn(catalogue).map(String);

  const collection = draft.listType === "collection";
  const limit = collection ? 0 : Number(draft.pointsLimit) || 0;
  const faction = factions.find((one) => one.id === draft.factionId) ?? null;

  const refusal = refusalFor(
    { name: draft.name, listType: draft.listType, pointsLimit: draft.pointsLimit,
      factionId: draft.factionId, detachments: draft.detachments },
    { factionIds: factions.map((one) => one.id), pointsOptions },
    priced);

  // The army's one disposition, and what the chosen detachments offer. Kept
  // to what is still on offer: dropping a detachment can take the only one
  // that offered the chosen disposition with it, and a list pointing at
  // something nothing offers is one the picker cannot show.
  const offered = dispositionsForAll(
    catalogue, draft.factionId, draft.detachments.map((one) => one.detachment));
  const disposition = heldDisposition(oneDisposition(draft.detachments), offered);

  const setDisposition = (next: string) =>
    patch({ detachments: withDisposition(draft.detachments, next) });

  // Which steps can be reached. A list with no faction has no units to pick
  // from, so the last step would be an empty page with a search box on it.
  // The disposition is deliberately NOT a gate: a catalogue can record none
  // for a detachment, and a step nobody can answer must not stop the list.
  const ready = [
    true,
    Boolean(draft.name.trim() && (collection || draft.pointsLimit)),
    Boolean(draft.factionId),
    Boolean(draft.factionId && (collection || draft.detachments.length)),
    Boolean(draft.factionId && (collection || draft.detachments.length)),
  ];

  const save = () => startSaving(async () => {
    const answer = await saveArmyList({
      listId: draft.listId, slug,
      name: draft.name, listType: draft.listType, pointsLimit: draft.pointsLimit,
      factionId: draft.factionId, factionLabel: faction?.label ?? "",
      detachments: collection ? [] : draft.detachments,
      units: priced.lines.map((one) => ({
        unitName: one.unitName, optionLabel: one.optionLabel, quantity: one.quantity,
      })),
    });
    setState(answer);
    if (answer.error) return;

    // Back to the top of the page, which is where the list says what it now
    // is: its name, its faction, its points and its version count. Saving at
    // the bottom of a scrolling catalogue and staying there is a save nothing
    // confirms, which is what the client found.
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (answer.listId && !draft.listId) {
      // Straight to the list, which is where its health and coaching are. The
      // editor is a job somebody has just finished.
      router.replace(`/clubs/${slug}/army-builder/${answer.listId}`);
    } else {
      // An edit rewrites the heading's own figures, which are server-rendered.
      router.refresh();
    }
  });

  return (
    <BusyOverlay busy={busy} label="Saving the list">
      <Stack spacing={2.5}>
        <StepRail step={step} onStep={setStep} ready={ready} />

        {step === 5 ? (
          <PointsBar total={priced.total} limit={limit} collection={collection} />
        ) : null}

        {step === 1 ? (
          <StepDetails name={draft.name} listType={draft.listType}
            pointsLimit={draft.pointsLimit} pointsOptions={pointsOptions}
            onChange={patch} />
        ) : null}

        {step === 2 ? (
          <StepFaction factions={factions} factionId={draft.factionId}
            onPick={(next) => {
              if (!next) return setFaction("");
              if (draft.factionId && next.id !== draft.factionId && draft.units.length) {
                return setChanging({ id: next.id, label: next.label });
              }
              setFaction(next.id);
            }} />
        ) : null}

        {step === 3 ? (
          <StepDetachments catalogue={catalogue} factionId={draft.factionId}
            chosen={draft.detachments} collection={collection}
            // The army's one disposition rides onto whatever the list becomes,
            // including a detachment added after it was chosen: a row left
            // blank is one the rollups count as having no disposition at all.
            onChange={(next) => patch({
              detachments: withDisposition(next, disposition) })} />
        ) : null}

        {step === 4 ? (
          <StepDisposition catalogue={catalogue} factionId={draft.factionId}
            chosen={draft.detachments} disposition={disposition}
            collection={collection} onPick={setDisposition} />
        ) : null}

        {step === 5 ? (
          <Stack spacing={2.5}>
            {priced.dropped.length ? (
              <Alert severity="warning">
                {`This catalogue has no ${priced.dropped.join(", ")}, so `
                  + `${priced.dropped.length === 1 ? "it was" : "they were"} left out.`}
              </Alert>
            ) : null}
            <ArmyLines lines={priced.lines}
              onQuantity={(line, next) =>
                setQuantity(line.unitName, line.optionLabel, next)}
              onRemove={(line) => setQuantity(line.unitName, line.optionLabel, 0)} />
            <Box sx={{ borderTop: `1px solid ${tokens.rule}`, pt: 2.5 }}>
              <ArmyUnitPicker units={units} held={held} onAdd={addUnit} />
            </Box>
          </Stack>
        ) : null}

        <Stack direction="row" spacing={1.5}
          sx={{ alignItems: "center", flexWrap: "wrap", pt: 1 }} useFlexGap>
          {step > 1 ? (
            <Button size="large" variant="outlined"
              onClick={() => setStep(step - 1)}>Back</Button>
          ) : null}
          {step < 5 ? (
            <Button size="large" variant="contained" disabled={!ready[step]}
              onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button size="large" variant="contained" loading={busy}
              loadingPosition="start" disabled={Boolean(refusal)} onClick={save}>
              {draft.listId ? "Save changes" : "Save list"}
            </Button>
          )}
          {step === 5 && refusal ? (
            <Typography sx={{ color: tokens.danger, fontSize: "0.95rem" }}>
              {refusal}
            </Typography>
          ) : null}
          {/* The way out. Saving leaves you on the list so you can keep
              working on it, which is right, but a page with no finish on it
              reads as a page that has not finished. */}
          {step === 4 && !refusal ? (
            <LinkButton size="large" variant="outlined"
              href={draft.listId
                ? `/clubs/${slug}/army-builder/${draft.listId}`
                : `/clubs/${slug}/army-builder`}>
              {draft.listId ? "Done editing" : "All your lists"}
            </LinkButton>
          ) : null}
        </Stack>
      </Stack>

      <ConfirmDialog
        open={Boolean(changing)}
        title={`Change to ${changing?.label ?? ""}?`}
        body="The units in this list belong to the faction it was built for, so changing it empties the list."
        confirmLabel="Change it"
        onClose={() => setChanging(null)}
        onConfirm={() => {
          if (changing) setFaction(changing.id);
          setChanging(null);
        }} />
    </BusyOverlay>
  );
}
