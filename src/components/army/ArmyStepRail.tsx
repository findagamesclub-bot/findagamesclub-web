"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { mono } from "@/lib/tokens";

/**
 * The step rail.
 *
 * Sized as the page's own navigation rather than as a filter chip row: this is
 * the only way through the builder and the thing somebody looks at first, and
 * at `size="small"` it read as a row of tags under the heading. The number is
 * a plate rather than a prefix so a step is findable without reading.
 */
export function StepRail({
  step, onStep, ready,
}: {
  step: number;
  onStep: (next: number) => void;
  /** Which steps can be reached, so a half-filled list cannot jump to units. */
  ready: boolean[];
}) {
  const titles = ["List details", "Faction", "Detachments", "Units"];
  return (
    <Stack direction="row" spacing={1.25} sx={{ flexWrap: "wrap" }} useFlexGap>
      {titles.map((title, index) => {
        const here = step === index + 1;
        return (
          <Button key={title}
            variant={here ? "contained" : "outlined"}
            disabled={!ready[index]}
            onClick={() => onStep(index + 1)}
            sx={{ px: 2, py: 1.1, fontSize: "0.95rem", fontWeight: 600,
                  borderRadius: 1.5 }}>
            <Box component="span"
              sx={{ fontFamily: mono, fontSize: "0.8rem", fontWeight: 700,
                    mr: 1, opacity: here ? 0.75 : 0.55 }}>
              {index + 1}
            </Box>
            {title}
          </Button>
        );
      })}
    </Stack>
  );
}
