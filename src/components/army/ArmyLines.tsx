"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EmptyState from "@/components/ui/EmptyState";
import type { ListLine } from "@/utils/army-list";
import { mono, tokens } from "@/lib/tokens";

/**
 * What is in the list, and what each line costs.
 *
 * The same grid as the catalogue below it, deliberately: two lists of units on
 * one page drawn two different ways is one more thing to learn for no reason,
 * and the client has asked for this treatment on every list in the app.
 *
 * A card prints its line total rather than a multiplication, because once the
 * third copy of a unit costs more than the first two there is no number to
 * multiply. `unitPoints` is 0 in exactly that case, which is legacy's own
 * answer, so the card says "escalating" instead of something that does not add
 * up.
 */
/**
 * The option, and the model count only when the label does not already carry
 * it.
 *
 * Every option in the 40k catalogue is named for its size, so joining the two
 * printed "10 models · 10 models" on every line with a size option. Other
 * editions may name an option for a weapon instead, which is why the count is
 * dropped rather than the label.
 */
function optionLine(line: ListLine): string {
  const label = line.optionLabel.trim();
  const count = line.optionModelCount;
  const said = count !== null && count !== undefined
    && new RegExp(`\\b${count}\\b`).test(label);
  return [label, count && !said ? `${count} models` : null]
    .filter(Boolean).join(" · ");
}

export default function ArmyLines({
  lines, onQuantity, onRemove, readOnly = false,
}: {
  lines: ListLine[];
  onQuantity?: (line: ListLine, next: number) => void;
  onRemove?: (line: ListLine) => void;
  readOnly?: boolean;
}) {
  if (!lines.length) {
    return (
      <EmptyState title="Nothing in the list yet"
        description="Search the catalogue below and add the units you are taking." />
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
               gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                      sm: "repeat(2, minmax(0, 1fr))",
                                      lg: "repeat(3, minmax(0, 1fr))" } }}>
      {lines.map((line) => (
        <Stack key={`${line.unitName}::${line.optionLabel}`} spacing={1.25}
          sx={{ height: "100%", p: 2, borderRadius: 1.5,
                border: `1px solid ${tokens.brass}`,
                backgroundColor: tokens.paper }}>
          <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.3 }}>
            {line.unitName}
          </Typography>

          <Stack direction="row" spacing={1}
            sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
            <Typography sx={{ fontFamily: mono, fontSize: "1.5rem", fontWeight: 700,
                              lineHeight: 1, color: tokens.brass }}>
              {line.linePoints.toLocaleString("en-GB")}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.75rem",
                              color: tokens.inkMuted }}>
              {/* "140 each" beside "140" on a single copy says nothing. The
                  per-copy figure only earns its place once there is more than
                  one, and it is absent entirely once they stop agreeing. */}
              {line.quantity < 2 ? "points"
                : line.unitPoints ? `${line.unitPoints} each` : "escalating"}
            </Typography>
          </Stack>

          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                            color: tokens.inkMuted }}>
            {optionLine(line)}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={0.5}
            sx={{ alignItems: "center", pt: 1,
                  borderTop: `1px solid ${tokens.rule}` }}>
            {readOnly ? (
              <Typography sx={{ fontFamily: mono, fontSize: "0.85rem",
                                color: tokens.inkMuted }}>
                {`${line.quantity} in the list`}
              </Typography>
            ) : (
              <>
                <IconButton aria-label={`One fewer ${line.unitName}`}
                  onClick={() => onQuantity?.(line, line.quantity - 1)}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ fontFamily: mono, fontSize: "1.05rem", fontWeight: 700,
                                  minWidth: 28, textAlign: "center" }}>
                  {line.quantity}
                </Typography>
                <IconButton aria-label={`One more ${line.unitName}`}
                  onClick={() => onQuantity?.(line, line.quantity + 1)}>
                  <AddIcon fontSize="small" />
                </IconButton>
                <Box sx={{ flex: 1 }} />
                <IconButton aria-label={`Take ${line.unitName} out`}
                  onClick={() => onRemove?.(line)}>
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Stack>
        </Stack>
      ))}
    </Box>
  );
}
