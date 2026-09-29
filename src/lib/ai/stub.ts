import "server-only";

import type { AiAnswer, AiRequest, Provider } from "./provider";

/**
 * A provider that answers without a provider.
 *
 * `AI_PROVIDER=stub` runs the whole path with no key and no network: the job
 * row, `after()`, the schema shape, the unit check, the cost, the cache, the
 * rolling limit and every screen. When a real key arrives the only untested
 * thing left is one HTTP request, which is the part a stub cannot help with
 * anyway.
 *
 * It is deliberately obvious rather than convincing. Every sentence says it is
 * a stub, so a screenshot of it can never be mistaken for a real report, and
 * it names a unit that is genuinely in the faction plus one that is not, so
 * the "named a unit this catalogue does not have" path is exercised on every
 * single run rather than waiting for a model to misbehave.
 */

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

export const stub: Provider = {
  name: "stub",

  async run(request: AiRequest, model: string): Promise<AiAnswer> {
    const started = Date.now();
    // Long enough to see the progress card move through its first stage, short
    // enough not to make testing tedious.
    await wait(4000);

    const known = (request.cacheable ?? "")
      .split("\n").slice(1).filter(Boolean);
    const real = known[0] ?? "A unit from this faction";

    const note = (title: string) => ({
      title, detail: "Stub text. No model was called for this.",
    });

    const body: Record<string, unknown> = {
      overview:
        "This is a stub answer. AI_PROVIDER is set to stub, so nothing was "
        + "sent anywhere and no model wrote this. It exists to prove the run, "
        + "the storage and the screen all work before a key is added.",
      strengths: ["Stub strength one.", "Stub strength two."],
      weaknesses: ["Stub weakness one."],
      yourStrengths: ["Stub strength for your side."],
      theirStrengths: ["Stub strength for their side."],
      playstyleNotes: ["Stub playstyle note."],
      deploymentNotes: ["Stub deployment note."],
      questions: ["Stub question to ask them."],
      measures: ["Stub measure."],
      healthSummary: { label: "Stub", reason: "Stub reason." },
      roleBalance: [{ ...note("Stub role"), status: "watch" }],
      flaggedIssues: [{ ...note("Stub issue"), severity: "medium" }],
      threats: [{ ...note("Stub threat"), severity: "high" }],
      watchFor: [{ ...note("Stub thing to watch"), severity: "medium" }],
      patterns: [note("Stub pattern")],
      openings: [note("Stub opening")],
      gamePlan: [note("Stub plan")],
      suggestedChanges: [note("Stub change")],
      focusAreas: [note("Stub focus")],
      weeks: [{ week: 1, theme: "Stub week", actions: ["Stub action."] }],
      // One real and one invented, so the catalogue check is exercised every
      // run rather than only when a model happens to make something up.
      unitChangeSuggestions: [
        { unitName: real, ...note("A unit this faction has") },
        { unitName: "Stub Unit That Does Not Exist",
          ...note("Should be dropped and counted") },
      ],
    };

    return {
      json: body,
      provider: "stub",
      model: `${model} (stub)`,
      tokensIn: 1200,
      tokensOut: 800,
      tokensCached: 0,
      latencyMs: Date.now() - started,
    };
  },
};
