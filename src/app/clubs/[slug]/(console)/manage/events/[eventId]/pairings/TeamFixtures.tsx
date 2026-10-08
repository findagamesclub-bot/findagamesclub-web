"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RoundTables from "./RoundTables";
import { display, mono, tokens } from "@/lib/tokens";
import type { PairingMatch } from "@/types/eventEditor";
import type { TeamFixture } from "@/types/eventTeams";
import type { PairingArmy } from "@/services/eventPairingArmies.service";

/**
 * A round of a team event: fixtures, with their tables inside them.
 *
 * The fixture is the thing being read and the tables are the detail, so the
 * two team names and the running score sit at the top of a block and the
 * tables are the ordinary rows underneath. `RoundTables` draws them unchanged,
 * which is the whole point of a table being a table whether or not it has a
 * parent: Edit, Armies and the bin all keep working exactly as they do on an
 * individual draw.
 *
 * The score is never typed here. It is the sum of the tables below it, kept by
 * 0168's trigger, so a club types a table and the block above it moves.
 */
export default function TeamFixtures({
  fixtures, busy, armies, recordsArmies, onEdit, onArmies, onRemove, onRemoveFixture,
}: {
  fixtures: TeamFixture[];
  busy: boolean;
  armies: Record<string, PairingArmy>;
  recordsArmies: boolean;
  onEdit: (match: PairingMatch) => void;
  onArmies: (match: PairingMatch) => void;
  onRemove: (match: PairingMatch) => void;
  onRemoveFixture: (fixture: TeamFixture) => void;
}) {
  return (
    <Stack spacing={2}>
      {fixtures.map((fixture) => {
        const bye = fixture.teamTwo === null;
        const scored = fixture.scoreOne !== null && fixture.scoreTwo !== null;
        const played = fixture.tables.filter(
          (table) => table.scoreOne !== null || table.scoreTwo !== null).length;

        return (
          <Box key={fixture.id}
            sx={{ borderRadius: 2, border: `1px solid ${tokens.rule}`,
                  backgroundColor: tokens.surface, overflow: "hidden" }}>
            {/* Three columns with the score and the control as one child, so
                that group drops to its own row on a phone and the team names
                get the whole width. The same shape the tables underneath use,
                and the reason is the same: at 360 the sub-line was wrapping
                with the word TABLES alone on the second line. */}
            <Box
              sx={{ display: "grid", gap: 1.25, alignItems: "center",
                    px: 2, py: 1.5, backgroundColor: tokens.paper,
                    borderBottom: `1px solid ${tokens.rule}`,
                    gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", fontWeight: 700,
                                color: tokens.inkMuted, minWidth: 24 }}>
                {fixture.tableLabel || "—"}
              </Typography>

              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: display, fontSize: "0.98rem",
                                  fontWeight: 700 }} noWrap>
                  {fixture.teamOneName || "A team"}
                  {bye ? "" : ` v ${fixture.teamTwoName || "A team"}`}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                  letterSpacing: "0.08em", color: tokens.inkMuted }}>
                  {bye
                    ? "BYE"
                    // "2 OF 2 TABLES PLAYED" spelled the noun twice over and
                    // wrapped at 360 with TABLES alone on the second line.
                    : `${played} OF ${fixture.tables.length} PLAYED`
                      + (scored ? ` · ${fixture.gamesOne}-${fixture.gamesTwo} ON TABLES` : "")}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center",
                       justifySelf: "end",
                       gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                {/* Added up from the tables, so it is a figure and not a
                    control. Muted until somebody has played, because a fixture
                    nobody has started is not a nil-nil draw. */}
                <Typography sx={{ fontFamily: mono, fontSize: "1rem", fontWeight: 700,
                                  whiteSpace: "nowrap", flexShrink: 0,
                                  color: scored ? tokens.ink : tokens.inkMuted }}>
                  {scored ? `${fixture.scoreOne} - ${fixture.scoreTwo}` : "not played"}
                </Typography>

                <Button size="small" disabled={busy}
                  sx={{ flexShrink: 0, color: tokens.danger }}
                  onClick={() => onRemoveFixture(fixture)}>
                  Remove
                </Button>

              </Stack>
            </Box>

            <Box sx={{ p: 1.5 }}>
              {fixture.tables.length ? (
                <RoundTables matches={fixture.tables as PairingMatch[]} busy={busy}
                  armies={armies} recordsArmies={recordsArmies}
                  onEdit={onEdit} onArmies={onArmies} onRemove={onRemove} />
              ) : (
                <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                  {bye
                    ? "Nobody to play this round. They sit it out and the draw still shows them."
                    : "No tables under this fixture yet."}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
