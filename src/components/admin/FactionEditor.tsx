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
import FactionDispositionsDialog from "@/components/admin/FactionDispositionsDialog";
import UnitDialog from "@/components/admin/UnitDialog";
import {
  catalogueAction, detachmentUsageAction, type CatalogueState,
} from "@/app/admin/catalogue/actions";
import type { DetachmentRow, DetachmentUsage, PublishedEdition, UnitRow }
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
  view, counts, detachmentsHeld, factionLabel, knownDispositions,
}: {
  edition: PublishedEdition;
  factionId: string;
  factionLabel: string;
  /** Every disposition this edition already names, to seed the bulk box. */
  knownDispositions: string[];
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
  const [dropping, setDropping] = useState<DetachmentRow | null>(null);
  const [spreading, setSpreading] = useState(false);
  // What names the detachment about to be deleted. Read when the confirm
  // opens rather than with the list, because it walks every club's results and
  // army lists and a page of 24 would pay for it 24 times to draw nothing.
  // Null while it is being counted AND when the count would not answer, which
  // is why the dialog has a third sentence for "we could not tell".
  const [usage, setUsage] = useState<DetachmentUsage | null>(null);
  const [counting, startCount] = useTransition();

  useActionSuccess(state, () => {
    setEditingDetachment(null);
    setAddingDetachment(false);
    setEditingUnit(null);
    setAddingUnit(false);
    setRemoving(null);
    setDropping(null);
    setSpreading(false);
  });

  const askToDrop = (one: DetachmentRow) => {
    setDropping(one);
    setUsage(null);
    startCount(async () => {
      setUsage(await detachmentUsageAction(edition.id, one.id));
    });
  };

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
          {/* Two controls, and the faction-wide one is the quiet of the pair.
              It is the answer to "every detachment here offers one
              disposition", which is a job somebody does once per faction;
              adding a detachment is the ordinary act. */}
          {frozen ? null : (
            <Stack direction="row" spacing={1} useFlexGap
              sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button variant="text" size="small"
                onClick={() => setSpreading(true)}>
                Dispositions for all
              </Button>
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
                  onEdit={setEditingDetachment} onRemove={askToDrop} />
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

      <FactionDispositionsDialog
        open={spreading}
        where={factionLabel}
        detachments={counts.detachments}
        known={knownDispositions}
        busy={working}
        onSave={(dispositions) =>
          send({ intent: "faction-dispositions", dispositions })}
        onClose={() => setSpreading(false)}
      />

      {/* What it costs, counted before the press rather than discovered after
          it. The client's own worry on 22a is "data is not lost", and the
          honest answer is a number: a result and an army list version each
          keep the detachment's name as a string beside the catalogue version
          they were written against, so neither has a row for this to reach. */}
      <ConfirmDialog
        open={dropping !== null}
        title={`Remove ${dropping?.label ?? "this detachment"}?`}
        body={`It goes from this draft. ${
          counting || usage === null
            ? "Anything already recorded against a published version still reads the way it was played, because that version is frozen."
            : usage.results === 0 && usage.lists === 0
              ? "Nothing recorded names it yet."
              : `${usage.results} recorded ${usage.results === 1 ? "game" : "games"} and ${usage.lists} army list ${usage.lists === 1 ? "version" : "versions"} name it, and they keep it: each one stores the name beside the catalogue version it was written against, so none of them changes.`
        }`}
        confirmLabel="Remove it"
        destructive
        busy={working}
        onConfirm={() =>
          send({ intent: "remove-detachment", detachment: String(dropping?.id ?? 0) })}
        onClose={() => setDropping(null)}
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
