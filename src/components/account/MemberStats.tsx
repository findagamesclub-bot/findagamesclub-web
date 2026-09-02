import StatTiles from "@/components/ui/StatTiles";
import { memberRecord, streakLabel, type StatGame } from "@/utils/member-stats";

/**
 * A member's own record, from games we already hold.
 *
 * Every tile is a calculation over results the member or their club recorded.
 * Nothing here is captured for this panel, which is why it could be built
 * without waiting on anything.
 *
 * Each figure carries the working underneath it. "44.4%" on its own invites
 * "out of what", and a member who has played four games should be able to see
 * that is what the number is made of.
 */
export default function MemberStats({
  games, points, lifetimePoints, clubs, bookings, tickets,
}: {
  games: StatGame[];
  points: number;
  lifetimePoints: number;
  clubs: number;
  bookings: number;
  tickets: number;
}) {
  const record = memberRecord(games);
  const streak = streakLabel(record.streak);

  const tiles = [
    {
      label: "Games played",
      value: String(record.played),
      note: `${record.won} wins · ${record.drawn} draws · ${record.lost} losses`,
    },
    {
      label: "Win rate",
      value: record.winRate === null ? "—" : `${record.winRate}%`,
      note: record.averageFor === null
        // Said plainly rather than shown as zeroes, which would read as having
        // scored nothing rather than as nobody having filled the scores in.
        ? "No scores recorded yet"
        : `Average score ${record.averageFor} for · ${record.averageAgainst} against`,
    },
    {
      label: "Current streak",
      value: streak ?? "—",
      note: record.streak
        ? `${record.streak.length} ${record.streak.length === 1 ? "game" : "games"} running`
        : "Nothing scored yet",
      emphasis: record.streak?.kind === "won",
    },
    {
      label: "Longest win streak",
      value: String(record.longestWin),
      note: `Last five record ${record.lastFive}`,
    },
    {
      label: "Loyalty available",
      value: `${points.toLocaleString("en-GB")} pts`,
      note: `${lifetimePoints.toLocaleString("en-GB")} lifetime points`,
      emphasis: points > 0,
    },
    {
      label: "Active clubs",
      value: String(clubs),
      note: `${bookings} table ${bookings === 1 ? "booking" : "bookings"}`
        + ` · ${tickets} event ${tickets === 1 ? "booking" : "bookings"}`,
    },
  ];

  return <StatTiles tiles={tiles} />;
}
