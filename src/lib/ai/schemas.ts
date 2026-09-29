import "server-only";

/**
 * The shape each answer has to take.
 *
 * Ported from legacy's `response_schema` blocks (server.py:5218 onwards).
 * Every object is `additionalProperties: false` and lists every field as
 * required, which is what makes a provider's structured output actually
 * structured rather than a suggestion.
 *
 * The schema is not the last word. `narrow` runs after it, because a model
 * that has been told not to invent units invents units anyway, and a schema
 * cannot tell a real datasheet from a plausible one.
 */

const strings = { type: "array", items: { type: "string" } } as const;

const titled = (extra: Record<string, unknown>) => ({
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: { title: { type: "string" }, detail: { type: "string" }, ...extra },
    required: ["title", "detail", ...Object.keys(extra)],
  },
});

export const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    healthSummary: {
      type: "object",
      additionalProperties: false,
      properties: { label: { type: "string" }, reason: { type: "string" } },
      required: ["label", "reason"],
    },
    strengths: strings,
    weaknesses: strings,
    roleBalance: titled({ status: { type: "string" } }),
    flaggedIssues: titled({ severity: { type: "string" } }),
    suggestedChanges: titled({}),
    playstyleNotes: strings,
    unitChangeSuggestions: titled({ unitName: { type: "string" } }),
  },
  required: ["overview", "healthSummary", "strengths", "weaknesses",
    "roleBalance", "flaggedIssues", "suggestedChanges", "playstyleNotes",
    "unitChangeSuggestions"],
} as const;

export const MATCHUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    yourStrengths: strings,
    theirStrengths: strings,
    threats: titled({ severity: { type: "string" } }),
    gamePlan: titled({}),
    deploymentNotes: strings,
    unitChangeSuggestions: titled({ unitName: { type: "string" } }),
  },
  required: ["overview", "yourStrengths", "theirStrengths", "threats",
    "gamePlan", "deploymentNotes", "unitChangeSuggestions"],
} as const;

export const SCOUTING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    patterns: titled({}),
    watchFor: titled({ severity: { type: "string" } }),
    openings: titled({}),
    questions: strings,
  },
  required: ["overview", "patterns", "watchFor", "openings", "questions"],
} as const;

export const SEASON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    focusAreas: titled({}),
    weeks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          week: { type: "number" },
          theme: { type: "string" },
          actions: strings,
        },
        required: ["week", "theme", "actions"],
      },
    },
    measures: strings,
  },
  required: ["overview", "focusAreas", "weeks", "measures"],
} as const;

export const SCHEMAS = {
  coach: COACH_SCHEMA,
  matchup: MATCHUP_SCHEMA,
  scouting: SCOUTING_SCHEMA,
  season: SEASON_SCHEMA,
} as const;
