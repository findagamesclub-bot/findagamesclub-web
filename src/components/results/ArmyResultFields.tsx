"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArmyPicker from "./ArmyPicker";
import { unitsFor, type Catalogue } from "@/utils/army-catalogue";
import {
  BATTLE_ROLE, PRIMARY_MAX, SECONDARY_MAX, TURN_ORDER,
  readScore, scoreProblem, totalVp, type ResultArmy,
} from "@/utils/result-army";
import { mono, tokens } from "@/lib/tokens";

/**
 * What one side played.
 *
 * Collapsed by default: a club night result is a score and two names, and the
 * army is the thing somebody fills in when they care. Opening it is deliberate.
 *
 * The pickers cascade, which is the whole design: faction, then that faction's
 * detachments, then **that detachment's** dispositions. The legacy manifest is
 * explicit that a disposition belongs to a detachment, so a disposition from
 * another one is not offerable rather than merely refused. The database refuses
 * it too, because the anon key is public.
 */
export default function ArmyResultFields({
  title, catalogue, value, onChange,
}: {
  title: string;
  catalogue: Catalogue;
  value: ResultArmy;
  onChange: (next: ResultArmy) => void;
}) {
  const [open, setOpen] = useState(
    Boolean(value.factionId || value.primaryScore !== null));

  const units = unitsFor(catalogue, value.factionId).map((one) => one.name);

  const set = (patch: Partial<ResultArmy>) => onChange({ ...value, ...patch });
  const total = totalVp(value);

  const [primary, setPrimary] = useState(
    value.primaryScore === null ? "" : String(value.primaryScore));
  const [secondary, setSecondary] = useState(
    value.secondaryScore === null ? "" : String(value.secondaryScore));

  return (
    <Stack spacing={1.5}
      sx={{ p: 1.75, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.surface }}>
      <Stack direction="row" sx={{ alignItems: "center" }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", fontWeight: 700,
                          letterSpacing: "0.08em", color: tokens.inkMuted, flex: 1 }}>
          {title.toUpperCase()}
        </Typography>
        {total !== null ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", fontWeight: 700,
                            color: tokens.brass, mr: 1 }}>
            {`Total VP ${total}`}
          </Typography>
        ) : null}
        <Button size="small" variant="text" onClick={() => setOpen(!open)}
          endIcon={<ExpandMoreIcon
            sx={{ transform: open ? "rotate(180deg)" : "none",
                  transition: "transform 150ms ease" }} />}>
          {open ? "Hide" : value.factionId ? "Show" : "Add the army"}
        </Button>
      </Stack>

      <Collapse in={open} unmountOnExit>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {/* The three names, shared with the league table and the podium.
              Changing the faction also drops the unit picks, which belong to
              the faction that is no longer chosen. */}
          <ArmyPicker catalogue={catalogue} value={value} direction="row"
            onChange={(named) => set(named.factionId === value.factionId
              ? named
              : { ...named, mvpUnits: [], underwhelmingUnits: [] })} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Primary" value={primary} fullWidth
              error={Boolean(scoreProblem(primary, PRIMARY_MAX, "Primary"))}
              helperText={scoreProblem(primary, PRIMARY_MAX, "Primary")
                || `At most ${PRIMARY_MAX}.`}
              onChange={(event) => {
                setPrimary(event.target.value);
                set({ primaryScore: readScore(event.target.value, PRIMARY_MAX) });
              }} />
            <TextField label="Secondary" value={secondary} fullWidth
              error={Boolean(scoreProblem(secondary, SECONDARY_MAX, "Secondary"))}
              helperText={scoreProblem(secondary, SECONDARY_MAX, "Secondary")
                || `At most ${SECONDARY_MAX}.`}
              onChange={(event) => {
                setSecondary(event.target.value);
                set({ secondaryScore: readScore(event.target.value, SECONDARY_MAX) });
              }} />
          </Stack>

          {/* Ten points, and the total works itself out. Nobody types it: a
              figure the browser can name is a figure the browser can choose. */}
          <FormControlLabel
            control={<Checkbox checked={value.painted}
              onChange={(event) => set({ painted: event.target.checked })} />}
            label="Fully painted (+10)"
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Turn order" value={value.firstTurn} fullWidth
              onChange={(event) => set({ firstTurn: event.target.value })}>
              <MenuItem value="">Not said</MenuItem>
              {TURN_ORDER.map((one) => (
                <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Battle role" value={value.battleRole} fullWidth
              onChange={(event) => set({ battleRole: event.target.value })}>
              <MenuItem value="">Not said</MenuItem>
              {BATTLE_ROLE.map((one) => (
                <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
              ))}
            </TextField>
          </Stack>

          <Autocomplete multiple options={units} value={value.mvpUnits}
            disabled={!value.factionId}
            onChange={(_event, next) => set({ mvpUnits: next })}
            renderInput={(params) => <TextField {...params} label="Units that earned it" />}
          />
          <Autocomplete multiple options={units} value={value.underwhelmingUnits}
            disabled={!value.factionId}
            onChange={(_event, next) => set({ underwhelmingUnits: next })}
            renderInput={(params) => <TextField {...params} label="Units that did not" />}
          />

          <Box sx={{ height: 0 }} />
        </Stack>
      </Collapse>
    </Stack>
  );
}
