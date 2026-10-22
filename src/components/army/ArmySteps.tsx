"use client";

import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import IconButton from "@mui/material/IconButton";
import { detachmentsFor, dispositionsFor, dispositionsForAll, type CatalogueFaction }
  from "@/utils/army-catalogue";
import { mixedDispositions } from "@/utils/army-disposition";
import type { Catalogue } from "@/utils/army-catalogue";
import { mono, tokens } from "@/lib/tokens";

export type Detachment = { detachment: string; disposition: string };

/** Step 1. Legacy's own description: the type, a name, and the points level. */
export function StepDetails({
  name, listType, pointsLimit, pointsOptions, onChange,
}: {
  name: string;
  listType: "army-list" | "collection";
  pointsLimit: string;
  pointsOptions: string[];
  onChange: (patch: {
    name?: string; listType?: "army-list" | "collection"; pointsLimit?: string;
  }) => void;
}) {
  return (
    <Stack spacing={3} sx={{ maxWidth: 680 }}>
      <TextField label="List name" value={name} required fullWidth
        onChange={(event) => onChange({ name: event.target.value })}
        helperText="What you will recognise it by. Changing it later does not make a new version." />

      <TextField select label="What this is" value={listType} fullWidth
        onChange={(event) => onChange({
          listType: event.target.value as "army-list" | "collection" })}
        helperText="A collection is everything you own, so it has no points limit and no detachment.">
        <MenuItem value="army-list">Army list</MenuItem>
        <MenuItem value="collection">Collection</MenuItem>
      </TextField>

      {listType === "collection" ? null : (
        <TextField select label="Points" value={pointsLimit} required fullWidth
          onChange={(event) => onChange({ pointsLimit: event.target.value })}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="">Choose a points value</MenuItem>
          {pointsOptions.map((one) => (
            <MenuItem key={one} value={one}>{`${one} points`}</MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}

/** Step 2. Changing it empties the units, so it asks first. */
export function StepFaction({
  factions, factionId, onPick,
}: {
  factions: CatalogueFaction[];
  factionId: string;
  onPick: (faction: CatalogueFaction | null) => void;
}) {
  const held = factions.find((one) => one.id === factionId) ?? null;
  return (
    <Stack spacing={2} sx={{ maxWidth: 680 }}>
      <Autocomplete
        options={factions}
        value={held}
        getOptionLabel={(one) => one.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, next) => onPick(next)}
        renderInput={(params) => (
          <TextField {...params} label="Faction" required
            helperText="The units you can add come from this, so changing it clears the list." />
        )} />
    </Stack>
  );
}

/**
 * Step 3. A disposition sits inside its detachment's row, never beside it.
 *
 * Detachments only. The disposition moved to a step of its own, because the
 * game allows one for the whole army and a picker per row allowed as many as
 * you had detachments. The rule the feature is shaped around is unchanged and
 * is now enforced one level up: a disposition belongs to a detachment, so
 * step four offers what THESE detachments offer between them and nothing
 * else.
 */
export function StepDetachments({
  catalogue, factionId, chosen, onChange, collection,
}: {
  catalogue: Catalogue | null;
  factionId: string;
  chosen: Detachment[];
  onChange: (next: Detachment[]) => void;
  collection: boolean;
}) {
  const available = detachmentsFor(catalogue, factionId);
  const taken = new Set(chosen.map((one) => one.detachment));
  const spare = available.filter((one) => !taken.has(one.label));

  if (collection) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted, maxWidth: 680, fontSize: "1rem" }}>
        A collection is not played as one army, so it carries no detachment.
        Carry on to the units.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 820 }}>
      {chosen.map((row) => {
        const dispositions = dispositionsFor(catalogue, factionId, row.detachment);
        return (
          <Stack key={row.detachment} direction={{ xs: "column", sm: "row" }} spacing={1.5}
            sx={{ alignItems: { sm: "center" }, p: 2, borderRadius: 1.5,
                  border: `1px solid ${tokens.rule}` }}>
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
                {row.detachment}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                color: tokens.inkMuted }}>
                {dispositions.length
                  ? `${dispositions.length} ${dispositions.length === 1 ? "disposition" : "dispositions"}`
                  : "No dispositions recorded"}
              </Typography>
            </Stack>

            <IconButton size="small" aria-label={`Take ${row.detachment} out`}
              onClick={() => onChange(
                chosen.filter((one) => one.detachment !== row.detachment))}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        );
      })}

      {spare.length ? (
        <Box>
          <TextField select label="Add a detachment" value=""
            sx={{ minWidth: { xs: "100%", sm: 380 } }}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
            onChange={(event) => event.target.value && onChange([
              ...chosen, { detachment: event.target.value, disposition: "" }])}>
            <MenuItem value="">Choose one</MenuItem>
            {spare.map((one) => (
              <MenuItem key={one.id} value={one.label}>{one.label}</MenuItem>
            ))}
          </TextField>
        </Box>
      ) : null}

      {chosen.length === 0 ? (
        <Typography sx={{ color: tokens.inkMuted, fontSize: "1rem" }}>
          An army list needs at least one detachment.
        </Typography>
      ) : null}
    </Stack>
  );
}

/**
 * Step 4. One disposition for the whole army.
 *
 * The client's words: *"Only one disposition should be selected overall, but
 * multiple detachments can be selected ... the Disposition is its own next
 * step, and the options are based on what dispositions are associated to the
 * selected detachments."*
 *
 * What it writes is not a new shape. The one choice goes onto every
 * detachment row, which is what `army_lists.payload` has held since 0143 and
 * what the Meta Tracker reads; `utils/army-disposition.ts` carries the whole
 * of that reasoning.
 */
export function StepDisposition({
  catalogue, factionId, chosen, disposition, onPick, collection,
}: {
  catalogue: Catalogue | null;
  factionId: string;
  chosen: Detachment[];
  disposition: string;
  onPick: (next: string) => void;
  collection: boolean;
}) {
  const offered = dispositionsForAll(
    catalogue, factionId, chosen.map((one) => one.detachment));

  if (collection) {
    return (
      <Typography variant="body2"
        sx={{ color: tokens.inkMuted, maxWidth: 680, fontSize: "1rem" }}>
        A collection is not played as one army, so it carries no disposition.
        Carry on to the units.
      </Typography>
    );
  }

  if (chosen.length === 0) {
    return (
      <Typography sx={{ color: tokens.inkMuted, fontSize: "1rem" }}>
        Pick a detachment first. What you can play is decided by what you are
        bringing.
      </Typography>
    );
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 680 }}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted, fontSize: "1rem" }}>
        {chosen.length === 1
          ? `What ${chosen[0]!.detachment} is playing.`
          : `What the army is playing. One for all ${chosen.length} detachments.`}
      </Typography>

      {/* A list saved before the disposition moved here can carry one per
          detachment. Saying so beats silently keeping the first, which is
          what the picker below would otherwise look like it had done. */}
      {mixedDispositions(chosen) ? (
        <Typography variant="body2" sx={{ color: tokens.brass }}>
          This list was saved with a disposition on each detachment. Pick the
          one the army is playing and it replaces them.
        </Typography>
      ) : null}

      {offered.length ? (
        <TextField select label="Disposition" value={disposition}
          sx={{ minWidth: { sm: 360 } }}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          onChange={(event) => onPick(event.target.value)}
          helperText={chosen.length === 1
            ? `The ${offered.length} this detachment offers.`
            : `What these ${chosen.length} detachments offer between them.`}>
          <MenuItem value="">Not chosen</MenuItem>
          {offered.map((one) => (
            <MenuItem key={one} value={one}>{one}</MenuItem>
          ))}
        </TextField>
      ) : (
        <Typography sx={{ color: tokens.inkMuted, fontSize: "1rem" }}>
          This catalogue records no disposition for
          {chosen.length === 1 ? " that detachment" : " any of these detachments"},
          so there is nothing to pick. Carry on to the units.
        </Typography>
      )}
    </Stack>
  );
}
