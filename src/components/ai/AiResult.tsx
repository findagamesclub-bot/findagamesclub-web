import Stack from "@mui/material/Stack";
import { Lede, Points, Notes, Dropped, type Note } from "./AiCards";
import AiDisclaimer from "./AiDisclaimer";
import type { AiFeature } from "@/utils/ai-access";

type Answer = Record<string, unknown>;
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one) => typeof one === "string") : [];
const notes = (value: unknown): Note[] =>
  Array.isArray(value) ? (value as Note[]).filter((one) => one?.title) : [];

/**
 * One generated answer, whichever feature produced it.
 *
 * A switch rather than four components, because the four schemas are the same
 * three shapes in different orders: a paragraph, some points, some titled
 * notes. What differs between them is the order and the headings, which is
 * data rather than structure.
 */
export default function AiResult({
  feature, result,
}: {
  feature: AiFeature;
  result: unknown;
}) {
  const answer = (result ?? {}) as Answer;
  const dropped = list(answer.droppedUnits);

  return (
    <Stack spacing={2.5}>
      <Lede>{String(answer.overview ?? "")}</Lede>

      {feature === "coach" ? (
        <>
          <Notes title="Flagged" items={notes(answer.flaggedIssues)} />
          <Points title="Strengths" items={list(answer.strengths)} />
          <Points title="Weaknesses" items={list(answer.weaknesses)} />
          <Notes title="Role balance" items={notes(answer.roleBalance)} />
          <Notes title="Suggested changes" items={notes(answer.suggestedChanges)} />
          <Notes title="Units to consider" items={notes(answer.unitChangeSuggestions)} />
          <Points title="How it wants to be played" items={list(answer.playstyleNotes)} />
        </>
      ) : null}

      {feature === "matchup" ? (
        <>
          <Notes title="Threats" items={notes(answer.threats)} />
          <Points title="What you have going for you" items={list(answer.yourStrengths)} />
          <Points title="What they have" items={list(answer.theirStrengths)} />
          <Notes title="Game plan" items={notes(answer.gamePlan)} />
          <Points title="Deployment" items={list(answer.deploymentNotes)} />
          <Notes title="Units to consider" items={notes(answer.unitChangeSuggestions)} />
        </>
      ) : null}

      {feature === "scouting" ? (
        <>
          <Notes title="What they tend to bring" items={notes(answer.patterns)} />
          <Notes title="Watch for" items={notes(answer.watchFor)} />
          <Notes title="Openings" items={notes(answer.openings)} />
          <Points title="Worth asking them" items={list(answer.questions)} />
        </>
      ) : null}

      {feature === "season" ? (
        <>
          <Notes title="Focus areas" items={notes(answer.focusAreas)} />
          <SeasonWeeks weeks={answer.weeks} />
          <Points title="How you will know" items={list(answer.measures)} />
        </>
      ) : null}

      <Dropped names={dropped} />
      <AiDisclaimer />
    </Stack>
  );
}

/** The season plan's one shape the others do not have. */
function SeasonWeeks({ weeks }: { weeks: unknown }) {
  const rows = Array.isArray(weeks)
    ? (weeks as { week?: number; theme?: string; actions?: unknown }[])
    : [];
  if (!rows.length) return null;
  return (
    <Notes title="Week by week" items={rows.map((one, index) => ({
      title: `Week ${one.week ?? index + 1} · ${one.theme ?? ""}`.trim(),
      detail: list(one.actions).join(" · "),
    }))} />
  );
}
