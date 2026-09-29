"use client";

import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import IconButton from "@mui/material/IconButton";
import { detachmentsFor, dispositionsFor, type CatalogueFaction }
  from "@/utils/army-catalogue";
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
 * The rule the whole army feature is shaped around: a disposition belongs to a
 * detachment, not to a faction. Pairing one with the wrong detachment is not
 * offerable here rather than merely refused on save.
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
      {chosen.map((row, index) => {
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
                  ? `${dispositions.length} dispositions`
                  : "No dispositions recorded"}
              </Typography>
            </Stack>

            <TextField select label="Disposition" value={row.disposition}
              sx={{ minWidth: { sm: 300 } }}
              slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
              onChange={(event) => onChange(chosen.map((one, i) =>
                i === index ? { ...one, disposition: event.target.value } : one))}>
              <MenuItem value="">Not chosen</MenuItem>
              {dispositions.map((one) => (
                <MenuItem key={one} value={one}>{one}</MenuItem>
              ))}
            </TextField>

            <IconButton size="small" aria-label={`Take ${row.detachment} out`}
              onClick={() => onChange(chosen.filter((_, i) => i !== index))}>
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
