"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveRow from "@/components/ui/RemoveRow";
import {
  CADENCES, cadenceLabel, headlineLine, type OptionRow,
} from "@/utils/billing-options";
import { mono, tokens } from "@/lib/tokens";

/**
 * The ways one tier can be paid for.
 *
 * A tier is not one price. The column has held a list since 0008 and the editor
 * carried it through as a hidden field it could not change, so an owner had one
 * Price box and the club's real prices were whatever the import had put there.
 * The client found it from the other end: a renewals dialog offering Monthly
 * £15 under a tier that said £120.
 *
 * The headline is stated rather than typed. Legacy derives a tier's own price
 * from the first option (`primary_billing_option`, club_store.py:13811), so the
 * line underneath says what the club page will lead with. Two boxes that can
 * disagree is exactly the bug this replaces.
 */
export default function TierBilling({
  rows, onChange,
}: {
  rows: OptionRow[];
  onChange: (rows: OptionRow[]) => void;
}) {
  const set = (index: number, patch: Partial<OptionRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Stack spacing={1.25}
      sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        HOW THEY PAY
      </Typography>

      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nothing set, so this tier is free. Add a price if members pay for it.
        </Typography>
      ) : null}

      {rows.map((row, index) => (
        <Box key={index} sx={{ display: "grid", gap: 1.25, alignItems: "start",
               gridTemplateColumns: {
                 xs: "minmax(0, 1fr)",
                 sm: "minmax(0, 0.9fr) minmax(0, 0.6fr) minmax(0, 1.3fr) auto" } }}>
          <TextField select size="small" label="How often" value={row.cadence}
            onChange={(e) => set(index, { cadence: e.target.value })}>
            <MenuItem value="">Not said</MenuItem>
            {CADENCES.map((one) => (
              <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
            ))}
          </TextField>

          <TextField size="small" label="Price" value={row.price}
            onChange={(e) => set(index, { price: e.target.value })}
            placeholder="15" />

          {/* Rule 7: the explanation is helper text. A label reading "What to
              call it on the club page" shrinks into the outline and collides
              with it in Archivo. */}
          <TextField size="small" label="Call it" value={row.label}
            onChange={(e) => set(index, { label: e.target.value })}
            placeholder={cadenceLabel(row.cadence)}
            helperText={`Blank says "${cadenceLabel(row.cadence)}".`} />

          <RemoveRow what="way to pay"
            confirm={Boolean(row.price.trim() || row.label.trim())}
            body={<>
              {row.label.trim() || cadenceLabel(row.cadence)} comes off your club
              page and members can no longer be recorded as paying it. Anything
              already recorded stays. Nothing changes until you save.
            </>}
            onRemove={() => onChange(rows.filter((_, i) => i !== index))} />
        </Box>
      ))}

      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Button size="small" variant="outlined" startIcon={<AddIcon />}
          sx={{ alignSelf: "flex-start" }}
          onClick={() => onChange([...rows, { id: "", label: "", price: "", cadence: "" }])}>
          Add a way to pay
        </Button>

        {/* Said rather than typed, because the club page's headline IS the
            first of these and a second box for it could only ever disagree. */}
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                          color: tokens.brass, flex: 1, minWidth: 0 }}>
          {headlineLine(rows)}
        </Typography>
      </Stack>
    </Stack>
  );
}
