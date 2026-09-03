import FormGuide from "@/components/account/FormGuide";
import MicroBar from "@/components/ui/MicroBar";
import RunBars from "@/components/ui/RunBars";
import StatTiles from "@/components/ui/StatTiles";
import { memberRecord, streakLabel, type StatGame } from "@/utils/member-stats";
import { formGuide, winRuns } from "@/utils/member-form";
import { tokens } from "@/lib/tokens";

/**
 * How a member is playing at the moment.
 *
 * Deliberately narrow. The counts live on the strip above and the breakdowns
 * live in the analytics below, so what is left for this row is the part
 * neither of them says: the run they are on.
 *
 * Each figure carries its working underneath it and then a small graphic of
 * what it is made of. "50%" invites "out of what", and "longest win streak 2"
 * invites "once, or all the time?" — neither is answerable from the number.
 */
export default function MemberStats({ games }: { games: StatGame[] }) {
  const record = memberRecord(games);
  const streak = streakLabel(record.streak);
  const runs = winRuns(games);

  return (
    <StatTiles
      tiles={[
        {
          label: "Win rate",
          value: record.winRate === null ? "—" : `${record.winRate}%`,
          note: record.averageFor === null
            // Said plainly rather than shown as zeroes, which would read as
            // having scored nothing rather than as nobody having filled the
            // scores in.
            ? "No scores recorded yet"
            : `Average score ${record.averageFor} for · ${record.averageAgainst} against`,
          // The same three colours the record donut and the ranked bars use,
          // so a reader learns them once for the whole page.
          chart: (
            <MicroBar segments={[
              { key: "won", value: record.won, color: tokens.positive,
                title: `${record.won} won` },
              { key: "drawn", value: record.drawn, color: tokens.inkMuted,
                title: `${record.drawn} drawn` },
              { key: "lost", value: record.lost, color: tokens.danger,
                title: `${record.lost} lost` },
            ]} />
          ),
        },
        {
          label: "Current streak",
          value: streak ?? "—",
          note: record.streak
            ? `${record.streak.length} ${record.streak.length === 1 ? "game" : "games"} running`
            : "Nothing scored yet",
          emphasis: record.streak?.kind === "won",
          chart: <FormGuide results={formGuide(games, 8)} size="small" note={null} />,
        },
        {
          label: "Longest win streak",
          value: String(record.longestWin),
          note: `Last five record ${record.lastFive}`,
          chart: <RunBars runs={runs} />,
        },
      ]}
    />
  );
}
