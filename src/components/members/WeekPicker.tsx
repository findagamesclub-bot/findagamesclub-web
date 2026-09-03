"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";

const DAYS = [
  ["Monday", "Mo"], ["Tuesday", "Tu"], ["Wednesday", "We"], ["Thursday", "Th"],
  ["Friday", "Fr"], ["Saturday", "Sa"], ["Sunday", "Su"],
] as const;

/**
 * The same week the profile displays, only clickable.
 *
 * Editing a thing should look like the thing. A column of seven tickboxes bore
 * no relation to the strip it produced, so you could not tell what you were
 * making until you saved.
 */
export default function WeekPicker({ name, value }: { name: string; value: string[] }) {
  const [selected, setSelected] = useState<string[]>(value);

  const toggle = (day: string) =>
    setSelected((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <Stack spacing={1}>
      {selected.map((day) => (
        <input key={day} type="hidden" name={name} value={day} />
      ))}
      <Typography variant="body2" sx={{ color: "text.secondary", fontFamily: "var(--font-display)" }}>
        Nights you are usually free
      </Typography>
      {/* One line, always. Seven cells at a fixed 40px need 304px and this sits
          inside a card inside the account column, which on a 390px phone is
          narrower than that — so Sunday hung off the edge. They share the row
          instead and cap at the old size, so a wide form looks exactly as it
          did and a narrow one still reads as a week rather than wrapping into
          five days and a bit. */}
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "nowrap" }}>
        {DAYS.map(([day, short]) => {
          const on = selected.includes(day);
          return (
            <Box
              key={day}
              component="button"
              type="button"
              onClick={() => toggle(day)}
              aria-pressed={on}
              aria-label={day}
              sx={{
                flex: "1 1 0",
                minWidth: 0,
                maxWidth: { xs: 40, sm: 46 },
                height: { xs: 40, sm: 46 },
                cursor: "pointer",
                borderRadius: "3px",
                fontFamily: "var(--font-display)",
                fontSize: "0.85rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
                backgroundColor: on ? tokens.brand : tokens.paper,
                color: on ? "#FFFFFF" : tokens.inkMuted,
                border: `1px solid ${on ? tokens.brand : tokens.rule}`,
                "&:hover": { borderColor: tokens.brand },
              }}
            >
              {short}
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
