"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { isLegends } from "@/utils/army-catalogue";
import { copyPoints, type PricedUnit } from "@/utils/army-pricing";
import { fold } from "@/utils/text";
import { mono, tokens } from "@/lib/tokens";

/**
 * The faction's catalogue, to add from.
 *
 * A grid, three across, like every other list in this app. It shipped as one
 * full-width row per unit and the client caught it on sight, which is the
 * tenth time: a row per unit is a band of mostly empty screen, and thirty-two
 * units became four pages of something that fits on three.
 *
 * The Legends switch is legacy's (`army-builder.js:1950`) and only draws when
 * the faction has any. The price shown is what the NEXT copy would cost, not
 * the first, so adding a third Castigator says 175 before you press.
 */
export default function ArmyUnitPicker({
  units, held, onAdd,
}: {
  units: PricedUnit[];
  /** How many of each unit are already in the list, by folded name. */
  held: Map<string, number>;
  onAdd: (unit: PricedUnit, optionLabel: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hideLegends, setHideLegends] = useState(false);
  const [options, setOptions] = useState<Record<string, string>>({});

  const legendsCount = useMemo(
    () => units.filter((one) => isLegends(one.name)).length, [units]);

  const shown = useMemo(() => {
    const needle = fold(query.trim());
    return units.filter((one) =>
      (!hideLegends || !isLegends(one.name))
      && (!needle || fold(one.name).includes(needle)));
  }, [units, query, hideLegends]);

  const paged = usePagedList(shown, PER_PAGE.cards);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
        sx={{ alignItems: { sm: "center" } }}>
        <TextField fullWidth label="Find a unit" value={query}
          onChange={(event) => setQuery(event.target.value)} />
        {legendsCount ? (
          <FormControlLabel
            sx={{ flexShrink: 0, mr: 0 }}
            control={<Switch checked={hideLegends}
              onChange={(event) => setHideLegends(event.target.checked)} />}
            label={
              <Typography sx={{ fontFamily: mono, fontSize: "0.8rem",
                                color: tokens.inkMuted, whiteSpace: "nowrap" }}>
                {`Hide ${legendsCount} Legends`}
              </Typography>
            } />
        ) : null}
      </Stack>

      {shown.length === 0 ? (
        <Typography sx={{ color: tokens.inkMuted, fontSize: "1rem" }}>
          Nothing in this faction matches that.
        </Typography>
      ) : null}

      <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                        lg: "repeat(3, minmax(0, 1fr))" } }}>
        {paged.shown.map((unit) => {
          const label = options[unit.name] ?? unit.options?.[0]?.label ?? "";
          const next = (held.get(fold(unit.name)) ?? 0) + 1;
          const inList = next - 1;
          return (
            <Stack key={unit.name} spacing={1.25}
              sx={{ height: "100%", p: 2, borderRadius: 1.5,
                    border: `1px solid ${inList ? tokens.brass : tokens.rule}`,
                    backgroundColor: tokens.paper }}>
              <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.3 }}>
                {unit.name}
              </Typography>

              <Stack direction="row" spacing={1}
                sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
                <Typography sx={{ fontFamily: mono, fontSize: "1.25rem",
                                  fontWeight: 700, lineHeight: 1, color: tokens.brass }}>
                  {copyPoints(unit, next, label)}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.75rem",
                                  color: tokens.inkMuted }}>
                  {next > 1 ? `for the ${ordinal(next)}` : "points"}
                </Typography>
              </Stack>

              {(unit.options?.length ?? 0) > 1 ? (
                <TextField select size="small" value={label} fullWidth
                  onChange={(event) =>
                    setOptions((current) => ({ ...current, [unit.name]: event.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }} label="Option">
                  {(unit.options ?? []).map((one) => (
                    <MenuItem key={one.label ?? ""} value={one.label ?? ""}>
                      {one.label || "Default"}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}

              {/* Lines a row of cards' footers up however long the names above
                  them ran, which is the rule every other grid here follows. */}
              <Box sx={{ flex: 1 }} />

              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "center", pt: 1,
                      borderTop: `1px solid ${tokens.rule}` }}>
                {inList ? (
                  <Typography sx={{ flex: 1, fontFamily: mono, fontSize: "0.72rem",
                                    color: tokens.inkMuted }}>
                    {`${inList} in the list`}
                  </Typography>
                ) : <Box sx={{ flex: 1 }} />}
                <Button variant="outlined" startIcon={<AddIcon />}
                  onClick={() => onAdd(unit, label)}>
                  Add
                </Button>
              </Stack>
            </Stack>
          );
        })}
      </Box>

      <Pager page={paged.page} total={paged.total} size={PER_PAGE.cards}
        noun="units" onChange={paged.goTo} />
    </Stack>
  );
}

/** "3rd copy" reads better than "copy 3" on a card somebody is skimming. */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
