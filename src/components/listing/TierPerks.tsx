"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { PERK_FIELDS, PERK_GROUP_LABELS } from "@/utils/tier-benefits";
import { mono, tokens } from "@/lib/tokens";

/**
 * What a tier actually gets you.
 *
 * Folded away by default. Twenty-two perks open under every tier turns a page
 * about three tiers into a page about sixty-six switches, and most clubs set
 * four of them once and never look again.
 *
 * The whole object is posted as JSON rather than a field per perk, because the
 * saved shape is one jsonb column and anything this screen does not know about
 * has to survive the round trip untouched.
 */
export default function TierPerks({
  name, value, onChange,
}: {
  /** The form field the JSON is posted in. */
  name: string;
  value: string;
  onChange: (json: string) => void;
}) {
  const [open, setOpen] = useState(false);

  let held: Record<string, unknown> = {};
  try { held = JSON.parse(value || "{}") as Record<string, unknown>; } catch { held = {}; }

  const set = (key: string, next: unknown) =>
    onChange(JSON.stringify({ ...held, [key]: next }));

  const on = PERK_FIELDS.filter((perk) => {
    const raw = held[perk.key];
    return perk.kind === "flag" ? raw === true : Number(raw) > 0;
  }).length;

  const groups = ["savings", "access", "tools"] as const;

  return (
    <Box>
      <input type="hidden" name={name} value={value} />

      <Button size="small" variant="text" onClick={() => setOpen((was) => !was)}
        endIcon={<ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none",
                                       transition: "transform 150ms" }} />}
        sx={{ alignSelf: "flex-start", color: tokens.inkMuted }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.08em" }}>
          {on ? `${on} PERK${on === 1 ? "" : "S"} ON` : "NO PERKS YET"}
        </Typography>
      </Button>

      <Collapse in={open} unmountOnExit>
        <Stack spacing={2} sx={{ pt: 1.5 }}>
          {groups.map((group) => {
            const perks = PERK_FIELDS.filter((perk) => perk.group === group);
            if (!perks.length) return null;

            return (
              <Stack key={group} spacing={1}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                  letterSpacing: "0.1em", color: tokens.brass }}>
                  {PERK_GROUP_LABELS[group].toUpperCase()}
                </Typography>

                {perks.map((perk) => (
                  perk.kind === "flag" ? (
                    <FormControlLabel key={perk.key}
                      control={<Switch size="small" checked={held[perk.key] === true}
                        onChange={(event) => set(perk.key, event.target.checked)} />}
                      label={<Typography variant="body2">{perk.label}</Typography>} />
                  ) : (
                    <TextField key={perk.key} size="small" label={perk.label}
                      value={String(held[perk.key] ?? "")}
                      inputMode="numeric"
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        set(perk.key, Number.isFinite(next) && next > 0 ? next : 0);
                      }}
                      helperText={perk.kind === "percent" ? "A percentage. 0 for none." : undefined}
                    />
                  )
                ))}
              </Stack>
            );
          })}
        </Stack>
      </Collapse>
    </Box>
  );
}
