"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import ArmyVersionUnits from "./ArmyVersionUnits";
import { saveArmyList } from "@/app/clubs/[slug]/(console)/army-builder/actions";
import { diffUnits } from "@/utils/army-diff";
import { shortDate } from "@/utils/dates";
import type { ArmyVersion } from "@/services/armyLists.service";
import { mono, tokens } from "@/lib/tokens";

/**
 * What this list has been, and the way back to any of it.
 *
 * Restoring is not a special path: it saves the old version's payload, whose
 * signature differs from the current one, so the ordinary save makes it the
 * next version. History only ever grows, which is the point of it.
 */
export default function ArmyVersionList({
  slug, listId, versions, canEdit,
}: {
  slug: string;
  listId: number;
  /** Newest first. */
  versions: ArmyVersion[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, startRestore] = useTransition();
  const [state, setState] = useState<{ error?: string; notice?: string }>({});
  const [open, setOpen] = useState<ArmyVersion | null>(null);
  const [restoring, setRestoring] = useState<ArmyVersion | null>(null);
  useActionToast(state);

  const restore = (version: ArmyVersion) => startRestore(async () => {
    const answer = await saveArmyList({
      listId, slug, name: version.name, listType: version.listType,
      pointsLimit: version.pointsLimit, factionId: version.factionId,
      factionLabel: version.factionLabel, detachments: version.detachments,
      units: version.units.map((one) => ({
        unitName: one.unitName, optionLabel: one.optionLabel, quantity: one.quantity,
      })),
    });
    setState(answer);
    setRestoring(null);
    if (!answer.error) router.refresh();
  });

  return (
    <BusyOverlay busy={busy} label="Restoring that version">
      {/* A grid, like every other list here. Rows read top to bottom, which
          suits a sequence better, but the client asked for the house
          treatment and consistency is the stronger argument: this is the only
          list in the app that would have been drawn a different way. Newest
          first still holds, reading left to right like text. */}
      <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                        lg: "repeat(3, minmax(0, 1fr))" } }}>
        {versions.map((version, index) => {
          const before = versions[index + 1] ?? null;
          const change = before
            ? diffUnits(
                { factionLabel: before.factionLabel, detachment: "", disposition: "",
                  pointsLimit: before.pointsLimit, units: before.units },
                { factionLabel: version.factionLabel, detachment: "", disposition: "",
                  pointsLimit: version.pointsLimit, units: version.units })
            : null;
          const moved = change
            ? [
                change.added.length ? `+${change.added.length} added` : null,
                change.removed.length ? `-${change.removed.length} removed` : null,
                change.adjusted.map((one) =>
                  `${one.unit.unitName} ${one.from} to ${one.to}`).join(", ") || null,
              ].filter(Boolean).join(" · ")
            : "";
          return (
            <Stack key={version.id} spacing={1.25}
              sx={{ height: "100%", p: 2, borderRadius: 1.5,
                    backgroundColor: tokens.paper,
                    border: `1px solid ${index === 0 ? tokens.brass : tokens.rule}` }}>
              <Stack direction="row" spacing={1}
                sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                <Typography sx={{ fontFamily: mono, fontWeight: 700, fontSize: "1.1rem",
                                  color: index === 0 ? tokens.brass : tokens.ink }}>
                  {`v${version.versionNumber}`}
                </Typography>
                {index === 0 ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                    px: 0.75, py: 0.25, borderRadius: 0.75,
                                    backgroundColor: tokens.brassSoft, color: "#5c4310" }}>
                    CURRENT
                  </Typography>
                ) : null}
              </Stack>

              <Typography sx={{ fontSize: "0.95rem", lineHeight: 1.35 }}>
                {version.changeSummary || "Edited list details"}
              </Typography>

              {moved ? (
                <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                  color: tokens.inkMuted }}>
                  {moved}
                </Typography>
              ) : null}

              <Box sx={{ flex: 1 }} />

              <Typography sx={{ pt: 1, borderTop: `1px solid ${tokens.rule}`,
                                fontFamily: mono, fontSize: "0.68rem",
                                color: tokens.inkMuted }}>
                {`${version.totalPoints.toLocaleString("en-GB")} pts · `
                  + shortDate(version.createdAt)}
              </Typography>

              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
                <Button size="small" variant="outlined"
                  onClick={() => setOpen(version)}>
                  {`See the ${version.units.length} `
                    + `${version.units.length === 1 ? "unit" : "units"}`}
                </Button>
                {canEdit && index > 0 ? (
                  <Button size="small" variant="text"
                    onClick={() => setRestoring(version)}>
                    Restore
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          );
        })}
      </Box>

      <ArmyVersionUnits version={open} onClose={() => setOpen(null)} />

      <ConfirmDialog
        open={Boolean(restoring)}
        title={`Restore v${restoring?.versionNumber ?? ""}?`}
        body="Nothing is lost. It is saved as the next version, so what you have now stays in the history."
        confirmLabel="Restore it"
        busy={busy}
        onClose={() => setRestoring(null)}
        onConfirm={() => restoring && restore(restoring)} />
    </BusyOverlay>
  );
}
