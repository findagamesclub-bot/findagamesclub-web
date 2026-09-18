"use server";

/**
 * An action that takes its time, so the states in between can be looked at.
 *
 * A pending button is the hardest thing in this app to see: the real ones
 * answer in under a second, and both times one shipped with an unreadable
 * label it was because nobody could hold it still. Dev-only, like the page
 * that renders it.
 */
export async function slowAction(): Promise<{ notice: string }> {
  await new Promise((done) => setTimeout(done, 1600));
  return { notice: "Done." };
}
