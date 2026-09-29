"use client";

import { useActionState, useState, useTransition } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import BusyOverlay from "@/components/ui/BusyOverlay";
import Pager from "@/components/ui/Pager";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import EmptyState from "@/components/ui/EmptyState";
import MonoLabel from "@/components/ui/MonoLabel";
import NavTabs from "@/components/ui/NavTabs";
import DetachmentGrid from "@/components/admin/DetachmentGrid";
import UnitGrid from "@/components/admin/UnitGrid";
import DetachmentDialog from "@/components/admin/DetachmentDialog";
import UnitDialog from "@/components/admin/UnitDialog";
import { catalogueAction, type CatalogueState } from "@/app/admin/catalogue/actions";
import type { DetachmentRow, PublishedEdition, UnitRow }
  from "@/services/armyCatalogue.service";
import { mono, tokens } from "@/lib/tokens";

/**
 * One faction's detachments and units.
 *
 * Two tabs, not one scroll. A faction runs to 24 detachments and 88 units, so
 * stacking both put the units most of a screen below the fold and made the
 * page long enough to lose your place in. The tab is in the address, so it
 * survives a refresh and can be sent to somebody.
 *
 * Detachments are a handful, so they are a grid with no pager. Units page and
 * search in SQL: 1409 of them across the catalogue and a couple of hundred in
 * one faction is the thousand-row case, and nothing sorts them in the browser.
 *
 * A disposition sits inside its detachment rather than in a list of its own,
 * which is the legacy manifest's own policy and what makes a disposition from
 * another detachment unofferable rather than merely refused.
 */
export default function FactionEditor({
  edition, factionId, detachments, units, total, page, perPage, failed, query,
  view, counts, detachmentsHeld,
}: {
  edition: PublishedEdition;
  factionId: string;
  detachments: DetachmentRow[];
  units: UnitRow[];
  total: number; page: number; perPage: number; failed: boolean; query: string;
  view: "detachments" | "units";
  /** The whole faction's figures, for the tabs. Not this page of units. */
  counts: { detachments: number; units: number };
  /** Before the search narrowed them, so the count can say "3 of 9". */
  detachmentsHeld: number;
}) {
  const [state, act, working] =
    useActionState<CatalogueState, FormData>(catalogueAction, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [sifting, setSifting] = useState(false);
  const [editingDetachment, setEditingDetachment] = useState<DetachmentRow | null>(null);
  const [addingDetachment, setAddingDetachment] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitRow | null>(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [removing, setRemoving] = useState<UnitRow | null>(null);

  useActionSuccess(state, () => {
    setEditingDetachment(null);
    setAddingDetachment(false);
    setEditingUnit(null);
    setAddingUnit(false);
    setRemoving(null);
  });

  // See CatalogueBoard: the edition stays active while a draft is open, so
  // this has to ask whether the version it is on has been published.
  const frozen = edition.published;

  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    data.set("edition", edition.id);
    data.set("faction", factionId);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    start(() => act(data));
  };

  return (
    <Stack spacing={3}>
      {frozen ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
          {`${edition.catalogue_version} is published, so nothing here can be edited. Start a new draft on the catalogue page.`}
        </Typography>
      ) : null}

      <NavTabs
        ariaLabel="This faction"
        value={view}
        tabs={[
          { value: "detachments", label: "Detachments",
            href: `/admin/catalogue/${factionId}`, count: counts.detachments },
          { value: "units", label: "Units",
            href: `/admin/catalogue/${factionId}?view=units`, count: counts.units },
        ]}
      />

      {view === "detachments" ? (
        <Stack spacing={1.5}>
          {frozen ? null : (
            <Stack sx={{ alignItems: "flex-end" }}>
              <Button variant="outlined" size="small" startIcon={<AddIcon />}
                onClick={() => setAddingDetachment(true)}>
                New detachment
              </Button>
            </Stack>
          )}

          {/* A faction runs to 24 of these. The search reaches the dispositions
              as well as the name, because "which of these can take Priority
              Assets" is otherwise nine cards to read. */}
          <UrlFilterBar
            query={query}
            placeholder="Search the detachments, or a disposition"
            tab="" sort="" defaults={{ q: "" }}
            onBusy={setSifting}
          />

          <BusyOverlay busy={sifting} variant="dim" label="Filtering detachments">
            <Stack spacing={2}>
              {detachments.length === 0 ? (
                <EmptyState
                  title={query ? "No detachment matches that" : "No detachments yet"}
                  description={query
                    ? "Try a shorter word, or clear the search to see every one."
                    : "Add them one at a time, or import the legacy catalogue."} />
              ) : (
                <DetachmentGrid detachments={detachments} frozen={frozen}
                  onEdit={setEditingDetachment} />
              )}

              {detachments.length ? (
                <MonoLabel>
                  {query
                    ? `${detachments.length} of ${detachmentsHeld} detachments`
                    : `${detachmentsHeld} detachments`}
                </MonoLabel>
              ) : null}
            </Stack>
          </BusyOverlay>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {frozen ? null : (
            <Stack sx={{ alignItems: "flex-end" }}>
              <Button variant="contained" size="small" startIcon={<AddIcon />}
                onClick={() => setAddingUnit(true)}>
                New unit
              </Button>
            </Stack>
          )}

          {/* No tab row of its own: the count is on the page tab above, and a
              second strip saying "All units 35" under one saying "Units 35" is
              the same fact twice. */}
          <UrlFilterBar
            query={query}
            placeholder="Search this faction's units"
            // `view` is deliberately not in the defaults: anything named there
            // is dropped from the address when it matches, which would take
            // `view=units` off the URL on the first keystroke and throw the
            // reader back to the detachments. `nextSearch` keeps what it does
            // not own.
            tab="" sort="" defaults={{ q: "" }}
            onBusy={setSifting}
          />

          <BusyOverlay busy={sifting} variant="dim" label="Filtering units">
            <Stack spacing={2}>
              <UnitGrid units={units} failed={failed} query={query}
                frozen={frozen} onEdit={setEditingUnit} onRemove={setRemoving} />

              <Pager page={page} total={total} size={perPage} noun="units"
                href={{ path: `/admin/catalogue/${factionId}`,
                        params: { view: "units", q: query || undefined } }} />
            </Stack>
          </BusyOverlay>
        </Stack>
      )}

      <DetachmentDialog
        open={addingDetachment || editingDetachment !== null}
        detachment={editingDetachment}
        busy={working}
        onSave={(fields) => send({ intent: "detachment", ...fields })}
        onClose={() => { setAddingDetachment(false); setEditingDetachment(null); }}
      />

      <UnitDialog
        open={addingUnit || editingUnit !== null}
        unit={editingUnit}
        busy={working}
        onSave={(fields) => send({ intent: "unit", ...fields })}
        onClose={() => { setAddingUnit(false); setEditingUnit(null); }}
      />

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? "this unit"}?`}
        body="It goes from this draft. Any game already recorded against a published version still reads the way it was played, because that version is frozen."
        confirmLabel="Remove it"
        destructive
        busy={working}
        onConfirm={() => send({ intent: "remove-unit", unit: String(removing?.id ?? 0) })}
        onClose={() => setRemoving(null)}
      />
    </Stack>
  );
}
