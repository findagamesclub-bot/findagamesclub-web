/**
 * A draw pasted out of a spreadsheet.
 *
 * A tournament organiser has ten minutes between rounds and a spreadsheet open.
 * Retyping twenty tables into a form is the thing that does not happen, so the
 * paste box takes whatever the clipboard holds and says what it understood
 * before anything is saved.
 *
 * Four shapes, because people paste all four:
 *
 *   1 <tab> Ann <tab> Ben      a table number and two names
 *   Ann <tab> Ben              two names, tables numbered from 1
 *   Ann vs Ben                 what somebody types by hand
 *   1, Ann, Ben                a CSV export
 */

export type PastedMatch = {
  table: string;
  playerOne: string;
  playerTwo: string;
  /** Why this line could not be read. The row is kept so it can be shown. */
  problem: string | null;
};

const VS = /\s+(?:vs\.?|v\.?|versus|against)\s+/i;

/** Tabs first: a name can contain a comma ("Smith, A") and rarely a tab. */
function columns(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (VS.test(line)) return line.split(VS);
  return line.split(",");
}

const clean = (value: string | undefined) => (value ?? "").trim();

/** A cell that is only a number is a table, not a player. */
const isTable = (value: string) => /^[0-9]+$/.test(value);

export function parsePastedPairings(raw: string): PastedMatch[] {
  return raw
    .split(/\r?\n/)
    // Blank lines go, but the line itself is not trimmed: a trailing tab is
    // what makes "3<tab>Ann<tab>" a bye on table three rather than two cells.
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      // Trailing empties are kept while deciding: "3<tab>Ann<tab>" is a bye on
      // table three, and dropping the empty cell first read the 3 as a player.
      const cells = columns(line).map(clean);

      const leading = cells[0] ?? "";
      // Two cells and a number first is ambiguous, and taking it as a table
      // would lose a player. Three cells is a table and two players.
      const hasTable = cells.length >= 3 && isTable(leading);
      const table = hasTable ? leading : String(index + 1);
      const [one, two] = hasTable ? [cells[1], cells[2]] : [cells[0], cells[1]];

      const playerOne = clean(one);
      const playerTwo = clean(two);

      const problem = !playerOne
        ? "No player on this line."
        // A bye is a real result, so one name and nothing else is allowed. Two
        // names that are the same person is not.
        : playerTwo && playerOne.toLowerCase() === playerTwo.toLowerCase()
          ? "The same player twice."
          : null;

      return { table, playerOne, playerTwo, problem };
    });
}

/** What the preview says above the table. */
export function pasteSummary(matches: PastedMatch[]): string {
  const good = matches.filter((m) => !m.problem).length;
  const bad = matches.length - good;
  const byes = matches.filter((m) => !m.problem && !m.playerTwo).length;

  if (!matches.length) return "Nothing to read yet.";

  const parts = [`${good} ${good === 1 ? "table" : "tables"}`];
  if (byes) parts.push(`${byes} ${byes === 1 ? "bye" : "byes"}`);
  if (bad) parts.push(`${bad} ${bad === 1 ? "line" : "lines"} to look at`);
  return parts.join(" · ");
}
