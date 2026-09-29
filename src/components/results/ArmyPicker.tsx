"use client";

import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import {
  detachmentsFor, dispositionsFor, factionsIn, findFaction, type Catalogue,
} from "@/utils/army-catalogue";

/** What every screen that names an army has to say. */
export type ArmyNaming = {
  factionId: string;
  factionLabel: string;
  detachment: string;
  disposition: string;
};

/** Nothing said, which is what every one of these fields may be. */
export const NO_ARMY: ArmyNaming = {
  factionId: "", factionLabel: "", detachment: "", disposition: "",
};

/**
 * Faction, then that faction's detachments, then that detachment's
 * dispositions.
 *
 * The cascade is the whole design and it is one component because four screens
 * need it: a member's result, the club's, a league table and an event podium.
 * The legacy manifest is explicit that a disposition belongs to a detachment,
 * so one from another detachment is not offerable rather than merely refused.
 * `resolve_result_army` refuses it as well, because the anon key is public.
 */
export default function ArmyPicker({
  catalogue, value, onChange, size = "medium", direction = "column",
}: {
  catalogue: Catalogue;
  value: ArmyNaming;
  onChange: (next: ArmyNaming) => void;
  size?: "small" | "medium";
  /** A row where there is width for one, a column inside a dialog. */
  direction?: "row" | "column";
}) {
  const factions = factionsIn(catalogue);
  const detachments = detachmentsFor(catalogue, value.factionId);
  const dispositions = dispositionsFor(catalogue, value.factionId, value.detachment);

  // By id or by label, because a league table has held a typed name since 0024
  // and a picker holds the id. Matching on the id alone drew an empty box
  // beside a row whose own summary line said CUSTODES.
  const chosen = findFaction(catalogue, value.factionId);

  // Something is recorded and this catalogue has never heard of it: legacy
  // spellings like "Custodes" against "Adeptus Custodes", or an army from a
  // different game. Said out loud rather than shown as an empty box, because
  // an empty box reads as data that has been lost. What is stored stays stored
  // until somebody picks something.
  const unknown = Boolean(value.factionId.trim()) && !chosen;

  return (
    <Stack direction={direction === "row" ? { xs: "column", md: "row" } : "column"}
      spacing={direction === "row" ? 1 : 2}>
      <Autocomplete
        size={size}
        options={factions}
        getOptionLabel={(one) => one.label}
        value={chosen}
        onChange={(_event, next) => onChange({
          factionId: next?.id ?? "",
          factionLabel: next?.label ?? "",
          // A faction change clears what belonged to the old one rather than
          // leaving a detachment this faction has never had.
          detachment: "", disposition: "",
        })}
        sx={{ flex: 1, minWidth: 0 }}
        renderInput={(params) => (
          <TextField {...params} label="Faction"
            helperText={unknown
              ? `Recorded as "${value.factionId}", which is not in this catalogue.`
              : ""} />
        )}
      />

      <TextField select size={size} label="Detachment"
        // An unmatched faction has no detachments to offer, so the value would
        // fall outside the options and MUI would warn and render blank.
        value={unknown ? "" : value.detachment}
        disabled={!value.factionId || unknown}
        onChange={(event) => onChange({
          ...value, detachment: event.target.value, disposition: "",
        })}
        sx={{ flex: 1, minWidth: 0 }}
        helperText={unknown
          ? "Pick a faction this catalogue knows to change it."
          : value.factionId ? "" : "Pick a faction first."}>
        <MenuItem value="">Not said</MenuItem>
        {detachments.map((one) => (
          <MenuItem key={one.id} value={one.label}>{one.label}</MenuItem>
        ))}
      </TextField>

      <TextField select size={size} label="Disposition"
        value={unknown ? "" : value.disposition}
        disabled={!value.detachment || unknown}
        onChange={(event) => onChange({ ...value, disposition: event.target.value })}
        sx={{ flex: 1, minWidth: 0 }}
        helperText={value.detachment
          ? "Only the ones this detachment offers."
          : "Pick a detachment first."}>
        <MenuItem value="">Not said</MenuItem>
        {dispositions.map((one) => (
          <MenuItem key={one} value={one}>{one}</MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
