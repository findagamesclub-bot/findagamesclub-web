import { PRIMARY_TAGS, primaryTagFor, tagsFor, type Tag } from "./list-tags";
import type { ListLine } from "./army-list";

/**
 * What is wrong with a list, worked out without asking anybody.
 *
 * This is `_build_army_list_coaching_signals` (club_store.py:7410), and it is
 * the coach's real evidence: legacy's own system prompt tells the model to
 * "use the supplied deterministic list-health signals as the main evidence"
 * (server.py:5203). The model writes the prose; this decides what is true.
 *
 * Which is why it runs whether or not the model does. Legacy only ever sends
 * these signals away; here the screen shows them, so a list still gets a
 * useful review when the provider is down, the club is over its cap, or AI is
 * switched off entirely. That is the one place stage 11 departs on its own
 * merits rather than on the client's instruction.
 */

export type Severity = "high" | "medium" | "low";
export type Issue = { title: string; severity: Severity; detail: string };
export type Role = { title: string; status: "strong" | "watch" | "weak"; detail: string };

export type ListHealth = {
  summary: {
    totalPoints: number; pointsLimit: number;
    unitSelections: number; uniqueUnits: number; topTwoLinePoints: number;
  };
  tagCounts: Record<Tag, number>;
  tagPoints: Record<Tag, number>;
  roleBalance: Role[];
  flaggedIssues: Issue[];
  strengths: string[];
  healthSummary: { label: string; reason: string };
  duplicateUnits: { unitName: string; quantity: number; linePoints: number }[];
  configurationReadiness: {
    selectedCount: number; configuredDispositionCount: number;
    missingDispositionCount: number; missingDispositionDetachments: string[];
    isComplete: boolean;
  };
};

export type HealthInput = {
  units: ListLine[];
  totalPoints: number;
  pointsLimit: number;
  detachments: { detachment: string; disposition: string }[];
  /** Which detachments actually offer a disposition, so a blank one only counts when there was something to choose. */
  dispositionsFor?: (detachment: string) => string[];
};

const zero = () =>
  Object.fromEntries(PRIMARY_TAGS.map((t) => [t, 0])) as Record<Tag, number>;

export function listHealth(input: HealthInput): ListHealth {
  const units = input.units.filter((u) => String(u.unitName ?? "").trim());
  const limit = Math.max(0, Math.floor(input.pointsLimit) || 0);
  const total = Math.max(0, Math.floor(input.totalPoints) || 0);

  const tagCounts = zero();
  const tagPoints = zero();
  const duplicates: ListHealth["duplicateUnits"] = [];

  for (const unit of units) {
    const quantity = Math.max(1, unit.quantity || 0);
    const points = unit.linePoints || 0;
    const tags = tagsFor(unit.unitName);
    tagPoints[primaryTagFor(unit.unitName)] += points;
    for (const tag of tags) {
      tagCounts[tag] += quantity;
      tagPoints[tag] += points;
    }
    // Two of something that neither scores nor does actions is a job being
    // repeated rather than a board being covered.
    if (quantity >= 2 && !tags.has("objective") && !tags.has("action")) {
      duplicates.push({ unitName: unit.unitName, quantity, linePoints: points });
    }
  }

  const topTwo = [...units]
    .sort((a, b) => (b.linePoints || 0) - (a.linePoints || 0))
    .slice(0, 2)
    .reduce((sum, u) => sum + (u.linePoints || 0), 0);

  const antiTank = tagCounts.antiTank;
  // Either tag answers the same question, so the stronger of the two counts.
  const objective = Math.max(tagCounts.objective, tagCounts.action);
  const issues: Issue[] = [];
  const strengths: string[] = [];

  if (limit >= 1500 && antiTank <= 1) {
    issues.push({ title: "Anti-tank looks light", severity: "high",
      // "Only 0 ... selection" is the stage 5 singular slip wearing a new hat,
      // and nought is worth saying in words rather than as a figure.
      detail: `${antiTank === 1 ? "Only one selection is" : "Nothing in the list is"}`
        + " tagged as anti-tank, so heavy vehicles or monsters could be awkward"
        + " to answer." });
  } else if (antiTank === 2) {
    issues.push({ title: "Anti-tank is workable but thin", severity: "medium",
      detail: "You have some anti-tank presence, but losing one key piece could make target priority much tighter." });
  } else {
    strengths.push("You have multiple anti-tank threats, so armour and monsters should not be answered by a single piece alone.");
  }

  if (objective <= 1) {
    issues.push({ title: "Action economy looks weak", severity: "high",
      detail: "Very few utility or objective-focused units are showing, which could make actions, screening, and secondaries harder." });
  } else if (objective >= 3) {
    strengths.push("The list has enough objective and utility pieces to support actions, screens, and wider board coverage.");
  }

  if (tagCounts.mobility <= 1 && limit >= 1500) {
    issues.push({ title: "Mobility looks limited", severity: "medium",
      detail: "The list appears to rely on slower pieces, so you may struggle to pivot across the table or pressure distant objectives." });
  } else if (tagCounts.mobility >= 2) {
    strengths.push("You have enough mobile elements to pressure angles, threaten flanks, or recover tempo mid-game.");
  }

  if (duplicates.length) {
    const said = duplicates.slice(0, 3)
      .map((d) => `${d.unitName} x${d.quantity}`).join(", ");
    issues.push({ title: "Several roles are duplicated heavily", severity: "medium",
      detail: `The list is repeating a few premium jobs (${said}), which can reduce flexibility if the matchup punishes that role.` });
  }

  if (total && topTwo >= total * 0.45) {
    issues.push({ title: "A lot of points sit in a few units", severity: "medium",
      detail: `The top two line items hold ${topTwo} of ${total} points, so a bad trade or failed delivery could swing the game quickly.` });
  } else if (total && topTwo <= total * 0.3) {
    strengths.push("Points are spread fairly evenly, which should make the list less fragile to one bad trade.");
  }

  if (tagCounts.support <= 0) {
    issues.push({ title: "Support coverage looks light", severity: "low",
      detail: "There are very few obvious support or force-multiplier units, so the list may rely on raw datasheet quality more than layered buffs or utility." });
  } else {
    strengths.push("You have support pieces that should help your main damage or board-control units convert more reliably.");
  }

  if (tagCounts.durable >= 2) {
    strengths.push("The list includes multiple durable anchors, which should help you hold space and absorb counterpunches.");
  }

  const roleBalance: Role[] = ([
    ["Anti-tank", antiTank, "clear anti-tank threats"],
    ["Objective play", objective, "objective or action-capable pieces"],
    ["Mobility", tagCounts.mobility, "mobile threats or reposition tools"],
    ["Support", tagCounts.support, "support or force-multiplier pieces"],
    ["Durability", tagCounts.durable, "durable anchors"],
  ] as const).map(([title, count, noun]) => ({
    title,
    status: count >= 3 ? "strong" : count === 2 ? "watch" : "weak",
    detail: `${count} ${noun} identified from the current unit mix.`,
  }));

  const missing = input.detachments
    .filter((one) => !String(one.disposition ?? "").trim()
      && (input.dispositionsFor?.(one.detachment).length ?? 0) > 0)
    .map((one) => one.detachment);

  let label = "Balanced foundation";
  if (issues.some((one) => one.severity === "high")) label = "Needs attention";
  else if (issues.length >= 2) label = "Playable with trade-offs";

  if (missing.length) {
    issues.push({ title: "Disposition still to choose", severity: "low",
      detail: `Choose a disposition for ${missing.join(", ")} so analysis and coaching can use the full list configuration.` });
    if (label === "Balanced foundation") label = "Configuration to complete";
  }

  return {
    summary: {
      totalPoints: total, pointsLimit: limit,
      unitSelections: units.reduce((n, u) => n + Math.max(1, u.quantity || 0), 0),
      uniqueUnits: units.length,
      topTwoLinePoints: topTwo,
    },
    tagCounts, tagPoints, roleBalance,
    flaggedIssues: issues,
    strengths: strengths.slice(0, 4),
    healthSummary: {
      label,
      reason: issues.length
        ? saidIssues(issues)
        : strengths[0]
          ?? "The list has a usable baseline but would benefit from deeper coaching.",
    },
    duplicateUnits: duplicates.slice(0, 5),
    configurationReadiness: {
      selectedCount: input.detachments.length,
      configuredDispositionCount:
        input.detachments.filter((one) => String(one.disposition ?? "").trim()).length,
      missingDispositionCount: missing.length,
      missingDispositionDetachments: missing,
      isComplete: missing.length === 0,
    },
  };
}

/**
 * The flagged titles in one line.
 *
 * It used to be `issues[0].detail` verbatim, which printed the first flagged
 * card's own sentence directly above that card. A summary that repeats what
 * is underneath it is a summary doing nothing, so this names what is wrong
 * rather than restating the first of it.
 */
function saidIssues(issues: Issue[]): string {
  const titles = issues.map((one) => one.title);
  const lower = (title: string) => title.charAt(0).toLowerCase() + title.slice(1);
  if (titles.length === 1) return `${titles[0]}.`;
  if (titles.length === 2) return `${titles[0]}, and ${lower(titles[1])}.`;
  return `${titles[0]}, ${lower(titles[1])}, and ${titles.length - 2} more.`;
}
