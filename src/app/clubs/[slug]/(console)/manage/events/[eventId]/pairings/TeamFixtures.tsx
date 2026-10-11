"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RoundTables from "./RoundTables";
import { fixtureScores } from "@/utils/team-standings";
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
 * The score shown is the club's own where they have typed one, and the sum of
 * the tables below otherwise. 0168 refused to let a team score be typed at
 * all, on the grounds that it could then disagree with the games under it;
 * 0176 keeps both instead, because they answer two different questions. When a
 * club has scored a fixture itself the players' total sits beside it, so
 * nothing is hidden and the figure can always be checked.
 */
export default function TeamFixtures({
  fixtures, busy, armies, recordsArmies, onEdit, onArmies, onRemove,
  onRemoveFixture, onScoreFixture,
}: {
  fixtures: TeamFixture[];
  busy: boolean;
  armies: Record<string, PairingArmy>;
  recordsArmies: boolean;
  onEdit: (match: PairingMatch) => void;
  onArmies: (match: PairingMatch) => void;
  onRemove: (match: PairingMatch) => void;
  onRemoveFixture: (fixture: TeamFixture) => void;
  onScoreFixture: (fixture: TeamFixture) => void;
}) {
  return (
    <Stack spacing={2}>
      {fixtures.map((fixture) => {
        const bye = fixture.teamTwo === null;
        const { one, two } = fixtureScores(fixture);
        const scored = one !== null && two !== null;
        // Both figures exist and differ, so the total is worth showing beside
        // the one the club typed.
        const typed = fixture.pointsOne !== null && fixture.pointsTwo !== null;
        const totalled = fixture.scoreOne !== null && fixture.scoreTwo !== null;
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
                {/* Muted until somebody has played, because a fixture nobody
                    has started is not a nil-nil draw. */}
                <Stack sx={{ alignItems: "flex-end", flexShrink: 0 }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "1rem", fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    color: scored ? tokens.ink : tokens.inkMuted }}>
                    {scored ? `${one} - ${two}` : "not played"}
                  </Typography>
                  {/* Only when the two differ: repeating the same pair under
                      itself is a second line saying nothing. */}
                  {typed && totalled ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.6rem",
                                      letterSpacing: "0.06em", color: tokens.inkMuted,
                                      whiteSpace: "nowrap" }}>
                      {`PLAYERS ${fixture.scoreOne}-${fixture.scoreTwo}`}
                    </Typography>
                  ) : null}
                </Stack>

                {bye ? null : (
                  <Button size="small" disabled={busy} sx={{ flexShrink: 0 }}
                    onClick={() => onScoreFixture(fixture)}>
                    Score
                  </Button>
                )}

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
