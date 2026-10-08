"use client";

import ButtonBase from "@mui/material/ButtonBase";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import { METAL_TONES, matGrid, metalOf, mono, tokens } from "@/lib/tokens";

/**
 * Which metal a tier is struck in.
 *
 * Swatches rather than a dropdown of words. This is the one place in the app
 * where colour means rank, and asking an owner to pick "platinum" out of a
 * select and then go and look at the members' page to see what they chose is
 * the long way round. They pick gold by looking at gold.
 *
 * Colour never carries it alone: the chosen swatch takes a tick and the name
 * is set in mono beside the row, so the control still reads to somebody who
 * cannot tell platinum from silver.
 */
export default function TonePicker({
  value, onChange,
}: {
  value: string;
  onChange: (tone: string) => void;
}) {
  /**
   * What the plate is actually struck in, which is not always what is stored.
   * `metalOf` falls back to bronze for anything it does not know, including the
   * empty tone a brand new tier starts with and legacy's own `tier-3`. Reading
   * the raw value here left the line saying BRONZE with no swatch ticked, so
   * the label and the plate agreed and the tick did not.
   */
  const stored = value.trim().toLowerCase();
  const chosen = (METAL_TONES as string[]).includes(stored) ? stored : "bronze";

  return (
    <Stack spacing={0.75}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {`STRUCK IN · ${chosen.toUpperCase()}`}
      </Typography>

      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}
        role="radiogroup" aria-label="Metal">
        {METAL_TONES.map((tone) => {
          const metal = metalOf(tone);
          const on = chosen === tone;
          return (
            <ButtonBase key={tone} role="radio" aria-checked={on} aria-label={tone}
              onClick={() => onChange(tone)}
              sx={{ borderRadius: 1, p: 0.5,
                    "&:focus-visible": { outline: `2px solid ${tokens.brass}`,
                                         outlineOffset: 2 } }}>
              <Box sx={{ position: "relative", width: 34, height: 34, borderRadius: 1,
                         display: "grid", placeItems: "center", overflow: "hidden",
                         backgroundImage:
                           `linear-gradient(135deg, ${metal.deep} 0%, ${metal.base} 55%, ${metal.deep} 100%)`,
                         border: on ? `2px solid ${tokens.ink}` : `1px solid ${metal.deep}`,
                         transform: on ? "scale(1.06)" : "none",
                         transition: "transform 150ms ease" }}>
                <Box aria-hidden sx={{ position: "absolute", inset: 0,
                                       backgroundImage: matGrid(0.08) }} />
                {on ? (
                  <CheckIcon sx={{ position: "relative", fontSize: 18, color: "#FFFFFF" }} />
                ) : null}
              </Box>
            </ButtonBase>
          );
        })}
      </Stack>
    </Stack>
  );
}
