"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AiNote from "./AiNote";
import AiJobProgress from "./AiJobProgress";
import AiResult from "./AiResult";
import AiResultHeader from "./AiResultHeader";
import { useAiJob } from "@/hooks/useAiJob";
import {
  aiHistoryAction, runAiAction,
} from "@/app/clubs/[slug]/(console)/army-builder/ai-actions";
import { FEATURE_META, type AiFeature } from "@/utils/ai-access";
import { aiErrorCopy } from "@/utils/ai-errors";
import { AI_DEPLOYMENT_COPY, type AiDeployment } from "@/utils/ai-deployment";
import type { AiJob } from "@/types/ai";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * Run it, watch it, read it.
 *
 * One component for all four features. It opens on the last answer when there
 * is one, because a report somebody paid for should be there the next time
 * they look rather than needing to be paid for again.
 *
 * The blocked reason is shown, never hidden. A member on a tier without this
 * feature can see what it is and what it would take, which is the same call
 * the ticket desk and the army builder already make.
 *
 * The same goes for the site not having it switched on, and that one is newer:
 * `deployment` is read where the page renders rather than inside the run, so
 * the button is not drawn at all when it is already known that it cannot work.
 * It used to be offered, pressed, filed as a job, and answered a few seconds
 * later with a warning. That reads as a broken feature, and the client
 * reported it as one.
 *
 * And a saved report now says it is one. The match-up and scouting pages open
 * with nothing on screen, because the question is not known until an opponent
 * is picked, so the button reads "Plan this match-up" and a press could come
 * back with a report written weeks earlier and no word about it. The client
 * reported that as the feature not running at all. 0234 stops a report older
 * than a day answering a press; this says so for the ones inside the day,
 * which are the presses that genuinely should not cost a second run.
 */
export default function AiPanel({
  feature, slug, listId, opponent, opponentProfileId, reason, usage, initial,
  deployment,
}: {
  feature: AiFeature;
  slug: string;
  listId: number;
  opponent?: { factionId: string; factionLabel: string };
  /** Scouting: the clubmate the pack is about. */
  opponentProfileId?: string;
  /** Null when they may run it. Otherwise the rung they are stopped at. */
  reason: string | null;
  /** Whether this site can run it at all. Checked before the tier. */
  deployment: AiDeployment;
  usage: { message: string; limited: boolean; remaining: number | null };
  initial: AiJob | null;
}) {
  const [busy, start] = useTransition();
  const [jobId, setJobId] = useState<number | null>(
    initial && initial.status !== "failed" ? initial.id : null);
  const [error, setError] = useState("");
  // Every run this reader has had for this question (0236). The client asked
  // twice for the old ones to stay reachable; they have been in the table
  // since 0146 and nothing could open them.
  const [history, setHistory] = useState<
    { id: number; at: string; model: string }[]>([]);
  // Whether what is on screen was written by the press that put it there.
  // Starts true for a report the page opened with: that one is plainly saved,
  // and `AiResultHeader` has always dated it.
  const [saved, setSaved] = useState(Boolean(initial));

  const live = useAiJob(jobId);
  const job = live.data ?? (jobId === initial?.id ? initial : null);
  const running = job?.status === "queued" || job?.status === "running";
  // "Again" only when there is something to do again. A failed run produced
  // nothing, so offering to repeat it reads as though it worked the first
  // time, and forcing past a cache that holds nothing is pointless besides.
  const done = job?.status === "succeeded";

  // An effect, not a render-phase read: this is a round trip, and it has to
  // run again when the opponent changes, because that is a different
  // question with a different history.
  //
  // The state is set inside the promise's callback rather than in the effect
  // body, which is what `react-hooks/set-state-in-effect` is asking for, and
  // `alive` drops the answer to a question the reader has already moved on
  // from.
  const faction = opponent?.factionId ?? "";
  const load = useCallback(() => {
    let alive = true;
    aiHistoryAction({
      slug, feature, listId,
      ...(faction ? { opponent: { factionId: faction, factionLabel: "" } } : {}),
      opponentProfileId,
    })
      .then((answer) => { if (alive) setHistory(answer.jobs ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug, feature, listId, faction, opponentProfileId]);

  useEffect(() => {
    if (reason || deployment !== "on") return;
    return load();
  }, [load, reason, deployment]);

  const run = (force: boolean) => start(async () => {
    setError("");
    const answer = await runAiAction({
      slug, feature, listId, opponent, opponentProfileId, force });
    if (answer.error) return setError(answer.error);
    if (answer.jobId) {
      setSaved(Boolean(answer.cached));
      setJobId(answer.jobId);
      // A forced run adds a row to the history. Reloaded rather than guessed
      // at, because the row is only there once the model has answered.
      if (!answer.cached) load();
    }
  });

  // The site first, then the tier. Telling somebody their tier does not
  // include a feature that nobody on the site can run is a true sentence that
  // sends them to buy something which would change nothing.
  if (deployment !== "on") {
    return <AiNote kind="note">{AI_DEPLOYMENT_COPY[deployment]}</AiNote>;
  }

  if (reason) return <AiNote>{reason}</AiNote>;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Button variant="contained" startIcon={<AutoAwesomeIcon />}
          loading={busy} loadingPosition="start"
          disabled={running || usage.limited}
          onClick={() => run(done)}>
          {done ? "Run it again" : FEATURE_META[feature].title}
        </Button>
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                          color: usage.limited ? tokens.danger : tokens.inkMuted }}>
          {usage.message}
        </Typography>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {running && job ? <AiJobProgress startedAt={job.createdAt} /> : null}

      {job?.status === "failed" ? (
        <Alert severity="warning">{aiErrorCopy(job.errorCode)}</Alert>
      ) : null}

      {/* The ones before this one.
          Hidden only when the single run it holds is the one already on
          screen, because a list of one you are looking at is a control that
          says "here is the thing you are looking at". It is NOT hidden at one
          run otherwise, which was the bug: somebody who had spent their
          allowance could not press the button and could not reach the report
          they had spent it on. The client's item 8. */}
      {history.length > 1
        || (history.length === 1 && history[0]!.id !== jobId) ? (
        <Stack spacing={0.75}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.08em", color: tokens.inkMuted }}>
            EARLIER RUNS
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
            {history.map((one) => (
              <Button key={one.id} size="small"
                variant={one.id === jobId ? "contained" : "outlined"}
                disabled={running}
                onClick={() => { setSaved(true); setError(""); setJobId(one.id); }}
                sx={{ fontFamily: mono, fontSize: "0.68rem",
                      ...(one.id === jobId ? {} : { borderColor: tokens.rule,
                                                    color: tokens.ink }) }}>
                {shortDate(one.at)}
              </Button>
            ))}
          </Stack>
        </Stack>
      ) : null}

      {job?.status === "succeeded" ? (
        <Stack spacing={2}>
          {/* Said in words, not left to a date in a 0.7rem caption. Somebody
              who pressed a button and got a report is entitled to know
              whether it was written for that press. */}
          {saved ? (
            <AiNote kind="note">
              {`This is the ${FEATURE_META[feature].one} saved on `}
              {shortDate(job.finishedAt ?? job.createdAt)}
              {". It was not run again. Press Run it again for a fresh one, "}
              {"which is saved beside this one rather than replacing it."}
            </AiNote>
          ) : null}
          <AiResultHeader model={job.model} at={job.finishedAt ?? job.createdAt}
            about={aboutOf(job)} />
          <AiResult feature={feature} result={job.result} />
        </Stack>
      ) : null}
    </Stack>
  );
}

/** What the run was about, off the row rather than out of the page's state. */
function aboutOf(job: AiJob): string {
  const source = (job.source ?? {}) as {
    listName?: string; versionNumber?: number; opponent?: string;
  };
  return [
    source.listName ? `${source.listName} v${source.versionNumber ?? 1}` : "",
    source.opponent ? `against ${source.opponent}` : "",
  ].filter(Boolean).join(" · ");
}
