/**
 * What a run costs.
 *
 * Pure, and in `utils` rather than `lib/ai`, because the cap and the spend
 * view are arithmetic over a table rather than anything to do with a
 * provider. It is also the one number in stage 11 that is wrong silently if
 * the table is wrong, so it is the one that has a test.
 */

/** Pounds per million tokens. Placeholders: confirm before charging anybody. */
type Price = { input: number; cached: number; output: number };

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 15, cached: 1.5, output: 75 },
  "claude-sonnet-5": { input: 3, cached: 0.3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, cached: 0.1, output: 5 },
  "gpt-5.5": { input: 5, cached: 0.5, output: 30 },
  "gpt-5-mini": { input: 0.25, cached: 0.025, output: 2 },
};

/**
 * What one run cost, in pence.
 *
 * Four decimal places rather than whole pence. A small run is about a penny
 * and a large one a few, so rounding each to the nearest penny would lose
 * roughly half of a short run and the error would accumulate across a club's
 * month in whichever direction the rounding happened to fall.
 */
export function costPence(
  model: string,
  tokens: { in: number; out: number; cached: number },
): number {
  const price = PRICES[model];
  if (!price) return 0;
  const pounds =
    (tokens.in / 1_000_000) * price.input
    + (tokens.cached / 1_000_000) * price.cached
    + (tokens.out / 1_000_000) * price.output;
  return Math.round(pounds * 100 * 10_000) / 10_000;
}
