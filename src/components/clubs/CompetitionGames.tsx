"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMatchDetail, MatchDetailButton }
  from "@/components/results/MatchDetailControl";
import { mono, type Faction } from "@/lib/tokens";
import type { CompetitionMatch } from "@/types/competition";
import type { ResultArmy } from "@/types/event";

export type PlayedGames = {
  armies: Record<string, ResultArmy | null>;
  setup: Record<number, { mission: string; deployment: string; terrain: string }>;
};

/**
 * The games in one round of a league, and what was played in them.
 *
 * Its own client component because `CompetitionCard` is a Server Component
 * and the dialog needs state. Handing an onClick down from there would throw
 * "Functions cannot be passed directly to Client Components" at request time
 * with every check green, which this codebase has paid for more than once.
 *
 * `played` is absent on the club page, which shows three competitions and
 * does not read the armies. The row then draws exactly what it always drew.
 *
 * The dialog half is `useMatchDetail`, shared with both rivalry lists: four
 * screens asking the same question should not be four answers to it.
 */
export default function CompetitionGames({
  matches, faction, played,
}: {
  matches: CompetitionMatch[];
  faction: Faction;
  played?: PlayedGames;
}) {
  const detail = useMatchDetail(faction);

  return (
    <>
      {matches.map((match, i) => {
        const one = played?.armies[`${match.id}:one`] ?? null;
        const two = played?.armies[`${match.id}:two`] ?? null;
        const setup = played?.setup[match.id] ?? null;
        const recorded = Boolean(one || two || setup);

        return (
          <Stack key={match.id || i} spacing={0.25}>
            <Stack direction="row" spacing={1.25}
              sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {match.playerOne}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.84rem",
                                color: faction.deep, fontWeight: 700 }}>
                {match.playerOneScore} – {match.playerTwoScore}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {match.playerTwo}
              </Typography>
            </Stack>

            {/* The same line and the same way in as a table of an event draw,
                because a game is a game wherever it was played. */}
            {recorded ? (
              <MatchDetailButton faction={faction} setup={setup}
                onOpen={() => detail.open({
                  label: `${match.playerOne} v ${match.playerTwo}`,
                  playerOne: match.playerOne, playerTwo: match.playerTwo,
                  scoreOne: match.playerOneScore, scoreTwo: match.playerTwoScore,
                  armyOne: one, armyTwo: two, setup,
                })} />
            ) : null}
          </Stack>
        );
      })}

      {/* One dialog for the round rather than one per game: only one is ever
          open and a season has a great many games. */}
      {detail.dialogs}
    </>
  );
}
