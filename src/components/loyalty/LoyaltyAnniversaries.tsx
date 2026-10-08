"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveRow from "@/components/ui/RemoveRow";
import type { AnniversaryDraft } from "@/utils/loyalty-tiers";
import { tokens } from "@/lib/tokens";

/**
 * What a year of membership is worth.
 *
 * Worked out on read rather than on a schedule, so a club nobody visits for a
 * year still owes the right points the moment somebody looks. Changing these
 * therefore changes what is owed, including for anniversaries that have
 * already passed and not yet been paid, which is why the line below says so.
 */
export default function LoyaltyAnniversaries({
  rows, onChange,
}: {
  rows: AnniversaryDraft[];
  onChange: (rows: AnniversaryDraft[]) => void;
}) {
  const set = (index: number, patch: Partial<AnniversaryDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Awarded on the day a membership comes round, and backdated: a member who
        passed two years while this was empty collects as soon as you set it.
      </Typography>

      {rows.map((row, index) => (
        <Box key={index}>
          <input type="hidden" name="anniversaryYears" value={row.years} />
          <input type="hidden" name="anniversaryPoints" value={row.points} />
          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start",
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr) minmax(0, 1fr) auto",
                   sm: "minmax(0, 0.8fr) minmax(0, 0.8fr) auto" } }}>
            <TextField size="small" label="Years" value={row.years} inputMode="numeric"
              onChange={(e) => set(index, { years: e.target.value })} />
            <TextField size="small" label="Points" value={row.points} inputMode="numeric"
              onChange={(e) => set(index, { points: e.target.value })} />
            <RemoveRow what="anniversary"
              confirm={Boolean(row.years.trim() || row.points.trim())}
              body={<>
                Members stop collecting at {row.years.trim() || "that"} years.
                Points already awarded stay. Nothing changes until you save.
              </>}
              onRemove={() => onChange(rows.filter((_, i) => i !== index))} />
          </Box>
        </Box>
      ))}

      <Button size="small" variant="outlined" startIcon={<AddIcon />}
        sx={{ alignSelf: "flex-start" }}
        onClick={() => onChange([...rows, { years: "", points: "" }])}>
        Add an anniversary
      </Button>
    </Stack>
  );
}
