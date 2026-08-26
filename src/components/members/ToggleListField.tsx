"use client";

import { useState } from "react";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";

/** A fixed set of choices, any number of them. Chips rather than checkboxes: the
 *  answer is a short list of short words, and a column of tickboxes for seven
 *  days takes more space than the rest of the form. */
export default function ToggleListField({
  name, label, options, value,
}: {
  name: string;
  label: string;
  options: readonly string[];
  value: string[];
}) {
  const [selected, setSelected] = useState<string[]>(value);

  const toggle = (option: string) =>
    setSelected((current) =>
      current.includes(option) ? current.filter((v) => v !== option) : [...current, option],
    );

  return (
    <Stack spacing={1}>
      {selected.map((item) => (
        <input key={item} type="hidden" name={name} value={item} />
      ))}
      <Typography variant="body2" sx={{ color: "text.secondary", fontFamily: "var(--font-display)" }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <Chip
              key={option}
              label={option}
              onClick={() => toggle(option)}
              aria-pressed={on}
              sx={{
                fontFamily: "var(--font-display)",
                backgroundColor: on ? tokens.brandSoft : "transparent",
                color: on ? tokens.brandDeep : tokens.inkMuted,
                border: `1px solid ${on ? tokens.brand : tokens.rule}`,
                fontWeight: on ? 600 : 500,
              }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
