"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RemoveRow from "@/components/ui/RemoveRow";
import { display, mono, tokens } from "@/lib/tokens";
import type { PairingMatch } from "@/types/eventEditor";
import type { PairingArmy } from "@/services/eventPairingArmies.service";

/**
 * One round's tables.
 *
 * Rows rather than a table element: the same three facts have to read on a
 * phone held in one hand at the back of a hall, and a four-column table at
 * 360px is a horizontal scroll nobody can use while holding dice.
 */
export default function RoundTables({
  matches, busy, armies, recordsArmies, onEdit, onArmies, onRemove,
}: {
  matches: PairingMatch[];
  busy: boolean;
  /** What is recorded, keyed `<matchId>:<side>`. Empty at most clubs. */
  armies: Record<string, PairingArmy>;
  /** False at a club that does not run the army builder, which hides all of it. */
  recordsArmies: boolean;
  onEdit: (match: PairingMatch) => void;
  onArmies: (match: PairingMatch) => void;
  onRemove: (match: PairingMatch) => void;
}) {
  // The faction and no more. The full line read "Chaos Knights · Traitoris
  // Lance · Purge the Foe v Adeptus Custodes · Shield Host", which is one line
  // on a desktop and wraps mid-phrase at 360: the "v" that separates the two
  // sides lands between two dots and the eye reads "Purge the Foe v Adeptus"
  // as one army. The row answers what was brought; the dialog answers the
  // detail, and a pair of faction names fits on one line at any width.
  const said = (match: PairingMatch, side: "one" | "two") =>
    armies[`${match.id}:${side}`]?.factionLabel ?? "";

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

              {/* What is recorded, so the club can see its own work without
                  opening twenty dialogs to check. Silent when there is
                  nothing, because "not said" is the ordinary case. */}
              {recordsArmies && (said(match, "one") || said(match, "two")) ? (
                <Typography variant="body2"
                  sx={{ fontSize: "0.78rem", color: tokens.inkMuted }}>
                  {[said(match, "one"), said(match, "two")]
                    .filter(Boolean).join(" v ")}
                </Typography>
              ) : null}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center",
                     justifySelf: "end", gridColumn: { xs: "1 / -1", sm: "auto" } }}>
              {/* The score reads as a score: figures in mono, muted when the
                  table has not been played, never a bare 0 standing in for
                  "nobody has said". */}
              <Stack spacing={0} sx={{ alignItems: "flex-end" }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                                  color: scored ? tokens.ink : tokens.inkMuted,
                                  whiteSpace: "nowrap" }}>
                  {scored ? `${match.scoreOne ?? 0} - ${match.scoreTwo ?? 0}` : "not played"}
                </Typography>

                {/* What the format counted this table at, where that is not
                    the victory points above it. Drawn only when the club has
                    said, and labelled, because two pairs of figures stacked
                    without a word between them is two scores nobody can tell
                    apart. */}
                {match.pointsOne !== null && match.pointsTwo !== null ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                    letterSpacing: "0.08em", color: tokens.inkMuted,
                                    whiteSpace: "nowrap" }}>
                    {`SCORED ${match.pointsOne}-${match.pointsTwo}`}
                  </Typography>
                ) : null}
              </Stack>

              <Button size="small" variant="outlined" disabled={busy}
                onClick={() => onEdit(match)} sx={{ flexShrink: 0 }}>
                Edit
              </Button>
              {recordsArmies ? (
                <Button size="small" variant="outlined" disabled={busy}
                  onClick={() => onArmies(match)} sx={{ flexShrink: 0 }}>
                  Armies
                </Button>
              ) : null}
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
