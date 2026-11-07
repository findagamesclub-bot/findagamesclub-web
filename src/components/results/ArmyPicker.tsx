"use client";

import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import {
  detachmentsFor, dispositionsForAll, factionsIn, findFaction, type Catalogue,
} from "@/utils/army-catalogue";
import { heldDisposition } from "@/utils/army-disposition";

/** What every screen that names an army has to say. */
export type ArmyNaming = {
  factionId: string;
  factionLabel: string;
  /** Several, and one disposition for all of them. See `ResultArmy`. */
  detachments: string[];
  disposition: string;
};

/** Nothing said, which is what every one of these fields may be. */
export const NO_ARMY: ArmyNaming = {
  factionId: "", factionLabel: "", detachments: [], disposition: "",
};

/**
 * Faction, then that faction's detachments, then what those detachments offer
 * between them.
 *
 * The cascade is the whole design and it is one component because four screens
 * need it: a member's result, the club's, a league table and an event podium.
 * The legacy manifest is explicit that a disposition belongs to a detachment,
 * so one from a detachment nobody brought is not offerable rather than merely
 * refused. `resolve_result_armies` refuses it as well, because the anon key is
 * public.
 *
 * Several detachments and ONE disposition, which is the army list builder's
 * own rule arriving one layer out. The client asked for exactly that, in those
 * words, and the union rather than the intersection for the reason
 * `dispositionsForAll` gives: a disposition one of them can play is a
 * disposition the army can play.
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
  /**
   * A basis only where the fields are in a row.
   *
   * In a column, flex-basis is the HEIGHT, so a 180px basis makes a 40px
   * picker 180px tall. The row is a column at xs and inside a dialog that
   * asks for one, which is most of the places this is used.
   */
  const span = (basis: string) => (direction === "row"
    ? { flex: { xs: "1 1 auto", md: `1 1 ${basis}` }, minWidth: 0 }
    : { minWidth: 0 });

  const factions = factionsIn(catalogue);
  const detachments = detachmentsFor(catalogue, value.factionId);
  const offered = dispositionsForAll(catalogue, value.factionId, value.detachments);

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

  // What is stored, whether or not this catalogue still offers it. A
  // detachment the catalogue has never heard of stays on screen as a chip the
  // club can read and take off, for the reason the faction branch above gives:
  // an empty box reads as data that has been lost. Only an unknown FACTION
  // empties this, because then there are no detachments to be right about.
  const held = unknown ? [] : value.detachments;

  // Stored and not offered. Named rather than blanked, which is the same rule
  // and the same mistake: a league game recorded against an older catalogue
  // showed an empty Disposition box, posted the value anyway, and came back
  // "is not a disposition those detachments offer" about a box that looked
  // empty. The club could see nothing to change.
  const strayDisposition = Boolean(value.disposition.trim())
    && !unknown
    && heldDisposition(value.disposition, offered) === "";

  return (
    // The row wraps rather than squeezing. Three fields in the 526px a side of
    // the game dialog gets is 170px each, which cut "Armoured Warhost" to
    // "Armo..." and "Reconnaissance" to "Reconnaiss...": a picker that cannot
    // say what is in it is the thing this item exists to fix. Each field
    // carries a basis it is readable at and the row flows at whatever width it
    // is given. `useFlexGap`, because a Stack spaces with margins and those
    // double on a wrapped line.
    <Stack direction={direction === "row" ? { xs: "column", md: "row" } : "column"}
      spacing={direction === "row" ? 1 : 2}
      useFlexGap sx={{ flexWrap: "wrap" }}>
      <Autocomplete
        size={size}
        options={factions}
        getOptionLabel={(one) => one.label}
        value={chosen}
        onChange={(_event, next) => onChange({
          factionId: next?.id ?? "",
          factionLabel: next?.label ?? "",
          // A faction change clears what belonged to the old one rather than
          // leaving detachments this faction has never had.
          detachments: [], disposition: "",
        })}
        sx={span("180px")}
        renderInput={(params) => (
          <TextField {...params} label="Faction"
            helperText={unknown
              ? `Recorded as "${value.factionId}", which is not in this catalogue.`
              : ""} />
        )}
      />

      {/* Several, which is the item. An Autocomplete rather than a multiple
          Select, because this dialog already picks its MVP units that way and
          a chip per detachment is how somebody sees at a glance that an army
          brought two. */}
      <Autocomplete
        multiple size={size}
        options={detachments.map((one) => one.label)}
        value={held}
        // A stored detachment this catalogue does not list is still a value,
        // so MUI is told how to compare rather than left to warn about it.
        isOptionEqualToValue={(option, chosen) => option === chosen}
        disabled={!value.factionId || unknown}
        onChange={(_event, next) => onChange({
          ...value,
          detachments: next,
          // What is left offered after the change. Taking a detachment out can
          // take the army's disposition with it, and keeping one these
          // detachments do not offer is the single thing the cascade exists to
          // stop; the database refuses it too.
          disposition: heldDisposition(
            value.disposition,
            dispositionsForAll(catalogue, value.factionId, next)),
        })}
        // The widest basis of the three, because it is the one field holding
        // several values and a chip has a delete button inside it.
        sx={direction === "row"
          ? { flex: { xs: "1 1 auto", md: "1.4 1 260px" }, minWidth: 0 }
          : { minWidth: 0 }}
        renderInput={(params) => (
          <TextField {...params} label="Detachments"
            helperText={unknown
              ? "Pick a faction this catalogue knows to change it."
              : value.factionId ? "One or more." : "Pick a faction first."} />
        )}
      />

      <TextField select size={size} label="Disposition"
        value={unknown ? "" : strayDisposition
          ? value.disposition
          : heldDisposition(value.disposition, offered)}
        disabled={held.length === 0 || unknown}
        onChange={(event) => onChange({ ...value, disposition: event.target.value })}
        sx={span("180px")}
        // The count, not just the rule. The client reported this box as broken
        // because it offered one option; it was offering every disposition the
        // detachment holds, and every detachment in the imported catalogue
        // held exactly one. A picker that says how many it has is a picker
        // nobody has to report.
        helperText={strayDisposition
          ? `Recorded as "${value.disposition}", which these detachments do not offer. Pick one of theirs.`
          : held.length === 0
          ? "Pick a detachment first."
          : offered.length === 0
            ? "These have none recorded."
            : held.length === 1
              ? `The ${offered.length} this detachment offers.`
              : `What these ${held.length} detachments offer between them.`}>
        <MenuItem value="">Not said</MenuItem>
        {strayDisposition ? (
          <MenuItem value={value.disposition}>{value.disposition}</MenuItem>
        ) : null}
        {offered.map((one) => (
          <MenuItem key={one} value={one}>{one}</MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
