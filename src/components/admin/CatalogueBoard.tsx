"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import MonoLabel from "@/components/ui/MonoLabel";
import UrlFilterBar from "@/components/ui/UrlFilterBar";
import StatusChip from "@/components/ui/StatusChip";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { catalogueAction, type CatalogueState } from "@/app/admin/catalogue/actions";
import type { PublishedEdition } from "@/services/armyCatalogue.service";
import { display, mono, tokens } from "@/lib/tokens";

type FactionRow = {
  id: string; label: string; position: number;
  detachments: number; units: number;
};

/**
 * The edition, and its factions as a grid.
 *
 * Thirty factions, so no pager: this is the one list in the app small enough
 * to be a single read, and its counts ride along as aggregates rather than as
 * sixty round trips. Each faction opens its own page, where the units do page.
 */
export default function CatalogueBoard({
  edition, factions, held, query, failed,
}: {
  edition: PublishedEdition;
  factions: FactionRow[];
  /** Every faction the edition holds, so the count can say "3 of 30". */
  held: number;
  query: string;
  failed: boolean;
}) {
  const [state, act, working] =
    useActionState<CatalogueState, FormData>(catalogueAction, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [sifting, setSifting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [version, setVersion] = useState("");

  useActionSuccess(state, () => {
    setPublishing(false);
    setDrafting(false);
    setVersion("");
  });

  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    data.set("edition", edition.id);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    start(() => act(data));
  };

  // Whether THIS version is frozen, not whether the edition is the live one.
  // An edition stays active while a draft is open on it.
  const live = edition.published;

  return (
    <Stack spacing={2.5}>
      {/* The edition plate. Which version is being edited is the one fact
          every other decision on this page depends on, so it leads. */}
      <Stack spacing={1.5}
        sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
              backgroundColor: tokens.paper }}>
        <Stack direction="row" spacing={1.5} useFlexGap
          sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1.15rem" }}>
            {edition.label}
          </Typography>
          <StatusChip label={live ? "Published" : "Draft"}
            tone={live ? "kept" : "waiting"} />
          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                            color: tokens.inkMuted }}>
            {edition.catalogue_version}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {live ? (
            <Button variant="outlined" size="small" onClick={() => setDrafting(true)}>
              Start a new draft
            </Button>
          ) : (
            <Button variant="contained" size="small" onClick={() => setPublishing(true)}>
              Publish this version
            </Button>
          )}
        </Stack>
        <Typography sx={{ fontSize: "0.9rem", color: tokens.inkMuted }}>
          {live
            ? "This version is frozen. Every game recorded against it keeps reading the way it was played, so editing means starting a new draft."
            : "Nothing has pinned this version yet, so it can still be edited. Publishing freezes it."}
        </Typography>
      </Stack>

      {/* Thirty rows is small enough to sift in one pass over what the page
          already read, but the filter still lives in the address like every
          other one, so a narrowed catalogue is a link. */}
      <UrlFilterBar
        query={query}
        placeholder="Search the factions by name"
        tab="" sort="" defaults={{ q: "" }}
        onBusy={setSifting}
      />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering factions">
      <Stack spacing={2}>
      {failed ? (
        <EmptyState title="The catalogue would not load"
          description="Nothing was read, so this is not an empty catalogue. Check the latest migrations have been run, then try again." />
      ) : factions.length === 0 ? (
        <EmptyState
          title={query ? "No faction matches that" : "No factions yet"}
          description={query
            ? "Try a shorter word, or clear the search to see every faction."
            : "Run scripts/import-army-catalogue.mjs to bring the legacy catalogue across."} />
      ) : (
        <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          sm: "repeat(2, minmax(0, 1fr))",
                                          lg: "repeat(3, minmax(0, 1fr))" } }}>
          {factions.map((faction) => (
            <Box key={faction.id} component={NextLink}
              href={`/admin/catalogue/${faction.id}`}
              sx={{ display: "flex", flexDirection: "column", height: "100%",
                    p: 2, borderRadius: 1.5, textDecoration: "none",
                    color: "inherit", border: `1px solid ${tokens.rule}`,
                    backgroundColor: tokens.paper,
                    transition: "border-color 120ms ease",
                    "&:hover": { borderColor: tokens.brand } }}>
              <Stack direction="row" spacing={1}
                sx={{ alignItems: "center", minWidth: 0 }}>
                <Typography sx={{ fontFamily: display, fontWeight: 700,
                                  fontSize: "1rem", flex: 1, minWidth: 0 }}>
                  {faction.label}
                </Typography>
                <ChevronRightIcon aria-hidden
                  sx={{ fontSize: 18, color: tokens.inkMuted }} />
              </Stack>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ mt: 1.5, pt: 1.25, fontFamily: mono,
                                fontSize: "0.7rem", color: tokens.inkMuted,
                                borderTop: `1px solid ${tokens.rule}` }}>
                {`${faction.detachments} ${faction.detachments === 1 ? "detachment" : "detachments"} · ${faction.units} ${faction.units === 1 ? "unit" : "units"}`}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

        {factions.length ? (
          <MonoLabel>
            {query
              ? `${factions.length} of ${held} factions`
              : `${held} factions`}
          </MonoLabel>
        ) : null}
      </Stack>
      </BusyOverlay>

      <ConfirmDialog
        open={publishing}
        title={`Publish ${edition.catalogue_version}?`}
        body="It freezes. Nothing in it can be edited afterwards, and every game recorded against it keeps reading the way it was played. Starting a new draft is how you change it again."
        confirmLabel="Publish it"
        busy={working}
        onConfirm={() => send({ intent: "publish", note: "" })}
        onClose={() => setPublishing(false)}
      />

      <ConfirmDialog
        open={drafting}
        title="Start a new draft"
        body="The published version stays exactly as it is. Give the new one a version so the two can be told apart."
        confirmLabel="Start editing"
        busy={working}
        blocked={!version.trim()}
        onConfirm={() => send({ intent: "draft", version })}
        onClose={() => { setDrafting(false); setVersion(""); }}
      >
        <TextField label="New version" value={version} fullWidth autoFocus
          onChange={(event) => setVersion(event.target.value.slice(0, 60))}
          helperText="Something datable, the way the legacy file names them." />
      </ConfirmDialog>
    </Stack>
  );
}
