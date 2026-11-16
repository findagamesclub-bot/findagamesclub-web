/**
 * How long a run is allowed to take.
 *
 * The AI work happens in `after()`, which keeps the reader's response fast
 * and still bills the time to the same serverless function. A match-up takes
 * forty to sixty seconds of thinking and writing; the host's default cuts a
 * function off long before that, so on a deployed site the model was called,
 * the function was killed mid-answer, and `finish_ai_job` never ran. The row
 * sat in flight until the five-minute sweep marked it lost.
 *
 * It never showed up locally, where nothing is cut off. 300 matches what the
 * three cron routes already ask for, and `TIMEOUT_MS` in `lib/ai/run.ts` is
 * the real bound at ninety seconds — this only has to be comfortably past it.
 *
 * A layout rather than four copies: every screen that can start a run is
 * under here, and the next one will be too.
 */
export const maxDuration = 300;

export default function ArmyBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
