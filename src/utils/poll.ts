/** A poll as it is stored on the post, and as the board draws it. */

export type PollOption = { key: string; label: string };
export type Poll = { question: string; options: PollOption[] };
export type PollResult = {
  question: string;
  options: (PollOption & { votes: number; percent: number })[];
  total: number;
  myVote: string | null;
};

/** Narrow the post's jsonb. A malformed poll is no poll, not a crash. */
export function parsePoll(raw: unknown): Poll | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const question = String(value.question ?? "").trim();
  const options = Array.isArray(value.options) ? value.options : [];

  const parsed = options
    .map((o) => {
      const row = (o ?? {}) as Record<string, unknown>;
      return { key: String(row.key ?? "").trim(), label: String(row.label ?? "").trim() };
    })
    .filter((o) => o.key && o.label);

  if (!question || parsed.length < 2) return null;
  return { question, options: parsed };
}

export function tally(poll: Poll, votes: { optionKey: string }[], myVote: string | null): PollResult {
  const counts = new Map<string, number>();
  for (const vote of votes) counts.set(vote.optionKey, (counts.get(vote.optionKey) ?? 0) + 1);

  const total = poll.options.reduce((n, o) => n + (counts.get(o.key) ?? 0), 0);

  return {
    question: poll.question,
    total,
    myVote,
    options: poll.options.map((o) => {
      const count = counts.get(o.key) ?? 0;
      return {
        ...o,
        votes: count,
        // Rounded for the bar width. Shares need not sum to 100 and the
        // numbers beside them are the real counts, so this is presentation.
        percent: total === 0 ? 0 : Math.round((count / total) * 100),
      };
    }),
  };
}

/**
 * Turn the poll builder's rows into what the post stores.
 *
 * Keys are positional and never reused, so a vote always points at the option
 * it was cast for even though the options themselves live in jsonb.
 */
export function buildPoll(question: string, labels: string[]): Poll | null {
  const clean = labels.map((l) => l.trim()).filter(Boolean);
  const text = question.trim();
  if (!text || clean.length < 2) return null;
  return {
    question: text,
    options: clean.slice(0, 8).map((label, i) => ({ key: `o${i + 1}`, label })),
  };
}
