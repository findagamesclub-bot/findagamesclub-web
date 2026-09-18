"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RemoveRow from "@/components/ui/RemoveRow";
import { display, mono, tokens } from "@/lib/tokens";
import type { PairingMatch } from "@/types/eventEditor";

/**
 * One round's tables.
 *
 * Rows rather than a table element: the same three facts have to read on a
 * phone held in one hand at the back of a hall, and a four-column table at
 * 360px is a horizontal scroll nobody can use while holding dice.
 */
export default function RoundTables({
  matches, busy, onEdit, onRemove,
}: {
  matches: PairingMatch[];
  busy: boolean;
  onEdit: (match: PairingMatch) => void;
  onRemove: (match: PairingMatch) => void;
}) {
  return (
    <Stack spacing={1}>
      {matches.map((match) => {
        const bye = !match.playerTwo.trim();
        const scored = match.scoreOne !== null || match.scoreTwo !== null;

        return (
          <Box key={match.id}
            // Three columns, with the score and both controls as one child.
            // On a phone that group drops to its own row and the names get the
            // whole width, which is the difference between reading the pairing
            // and reading "Ada Marchetti v Joe Mat…".
            sx={{ display: "grid", gap: 1.25, alignItems: "center", p: 1.75,
                  borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                  backgroundColor: tokens.paper,
                  gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", fontWeight: 700,
                              color: tokens.inkMuted, minWidth: 28 }}>
              {match.tableLabel || "—"}
            </Typography>

            <Stack spacing={0.3} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700 }}
                noWrap>
                {match.playerOne}
                {bye ? "" : ` v ${match.playerTwo}`}
              </Typography>
              {bye ? (
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                  letterSpacing: "0.08em", color: tokens.inkMuted }}>
                  BYE
                </Typography>
              ) : null}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center",
                     justifySelf: "end", gridColumn: { xs: "1 / -1", sm: "auto" } }}>
              {/* The score reads as a score: figures in mono, muted when the
                  table has not been played, never a bare 0 standing in for
                  "nobody has said". */}
              <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                                color: scored ? tokens.ink : tokens.inkMuted,
                                whiteSpace: "nowrap" }}>
                {scored ? `${match.scoreOne ?? 0} - ${match.scoreTwo ?? 0}` : "not played"}
              </Typography>

              <Button size="small" variant="outlined" disabled={busy}
                onClick={() => onEdit(match)} sx={{ flexShrink: 0 }}>
                Edit
              </Button>
              {/* The board asks before it removes, so the bin does not ask
                  twice. */}
              <RemoveRow what="table" confirm={false} disabled={busy}
                body="" onRemove={() => onRemove(match)} />
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
