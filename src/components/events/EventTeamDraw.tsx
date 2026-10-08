"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import { fold } from "@/utils/text";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { TeamFixture } from "@/types/eventTeams";

/**
 * A team event's draw as somebody playing in it reads it.
 *
 * The question is always "where am I", never "list the fixtures", so the
 * search is the control at the top and it narrows on a player's name as well
 * as a team's: at a team event you look yourself up and then look at who your
 * team is against, in that order.
 *
 * Rounds are not tabs here, the way they are in the console. A member is
 * reading one page and scrolling; the console is working a round at a time.
 */
export default function EventTeamDraw({ fixtures, faction, viewerName }: {
  fixtures: TeamFixture[];
  faction: Faction;
  viewerName: string | null;
}) {
  const [query, setQuery] = useState("");
  // The same spinner the individual draw shows, for the house rule that every
  // filter has one.
  const settled = useDeferredValue(query);
  const busy = settled !== query;
  const needle = fold(settled.trim());

  const shown = useMemo(() => {
    if (!needle) return fixtures;
    return fixtures.filter((fixture) =>
      fold(fixture.teamOneName).includes(needle)
      || fold(fixture.teamTwoName).includes(needle)
      || fixture.tables.some((table) =>
        fold(table.playerOne).includes(needle) || fold(table.playerTwo).includes(needle)));
  }, [fixtures, needle]);

  const me = fold(viewerName ?? "");
  const mine = (fixture: TeamFixture) =>
    Boolean(me) && fixture.tables.some((table) =>
      fold(table.playerOne) === me || fold(table.playerTwo) === me);

  const rounds = useMemo(() => {
    const byRound = new Map<number, TeamFixture[]>();
    for (const fixture of shown) {
      byRound.set(fixture.round, [...(byRound.get(fixture.round) ?? []), fixture]);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [shown]);

  return (
    <Stack spacing={2}>
      <TextField
        label="Find a team or a player" value={query} fullWidth
        onChange={(event) => setQuery(event.target.value)}
        helperText="Type a name to see only the fixtures it is in."
        sx={{ maxWidth: 420 }}
      />

      <BusyOverlay busy={busy} variant="dim" label="Filtering the draw">
        {rounds.length ? (
          <Stack spacing={3}>
            {rounds.map(([round, list]) => (
              <Stack key={round} spacing={1.25}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                  letterSpacing: "0.1em", color: tokens.inkMuted }}>
                  {`ROUND ${round}`}
                </Typography>

                {list.map((fixture) => {
                  const bye = fixture.teamTwo === null;
                  const scored = fixture.scoreOne !== null && fixture.scoreTwo !== null;

                  return (
                    <Box key={fixture.id}
                      sx={{ borderRadius: 2, overflow: "hidden",
                            border: `1px solid ${mine(fixture) ? faction.base : tokens.rule}`,
                            backgroundColor: tokens.paper }}>
                      <Stack direction="row" spacing={1.5}
                        sx={{ px: 2, py: 1.25, alignItems: "center",
                              backgroundColor: mine(fixture) ? faction.soft : tokens.surface,
                              borderBottom: `1px solid ${tokens.rule}` }}>
                        <Typography sx={{ fontFamily: mono, fontSize: "0.8rem",
                                          fontWeight: 700, color: tokens.inkMuted,
                                          minWidth: 22 }}>
                          {fixture.tableLabel || "—"}
                        </Typography>
                        <Typography sx={{ fontFamily: display, fontSize: "0.95rem",
                                          fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                          {fixture.teamOneName}
                          {bye ? "" : ` v ${fixture.teamTwoName}`}
                        </Typography>
                        <Typography sx={{ fontFamily: mono, fontSize: "0.9rem",
                                          fontWeight: 700, whiteSpace: "nowrap",
                                          color: scored ? tokens.ink : tokens.inkMuted }}>
                          {bye ? "BYE" : scored
                            ? `${fixture.scoreOne} - ${fixture.scoreTwo}` : "to play"}
                        </Typography>
                      </Stack>

                      {fixture.tables.map((table) => {
                        const table_scored = table.scoreOne !== null && table.scoreTwo !== null;
                        return (
                          <Stack key={table.id} direction="row" spacing={1.5}
                            sx={{ px: 2, py: 1, alignItems: "center",
                                  borderTop: `1px solid ${tokens.rule}` }}>
                            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                              color: tokens.inkMuted, minWidth: 26 }}>
                              {table.tableLabel}
                            </Typography>
                            <Typography sx={{ fontSize: "0.88rem", flex: 1, minWidth: 0 }}
                              noWrap>
                              {table.playerOne || "—"}
                              {table.playerTwo ? ` v ${table.playerTwo}` : ""}
                            </Typography>
                            <Typography sx={{ fontFamily: mono, fontSize: "0.8rem",
                                              fontWeight: 700, whiteSpace: "nowrap",
                                              color: table_scored ? tokens.ink : tokens.inkMuted }}>
                              {table_scored ? `${table.scoreOne} - ${table.scoreTwo}` : "to play"}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Box>
                  );
                })}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {`Nothing in the draw matches "${query.trim()}". Try part of a team name, or a player's surname.`}
          </Typography>
        )}
      </BusyOverlay>
    </Stack>
  );
}
