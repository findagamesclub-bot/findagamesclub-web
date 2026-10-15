"use client";

import { useState, useTransition } from "react";
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
import { runAiAction } from "@/app/clubs/[slug]/(console)/army-builder/ai-actions";
import { FEATURE_META, type AiFeature } from "@/utils/ai-access";
import { aiErrorCopy } from "@/utils/ai-errors";
import { AI_DEPLOYMENT_COPY, type AiDeployment } from "@/utils/ai-deployment";
import type { AiJob } from "@/types/ai";
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

  const live = useAiJob(jobId);
  const job = live.data ?? (jobId === initial?.id ? initial : null);
  const running = job?.status === "queued" || job?.status === "running";
  // "Again" only when there is something to do again. A failed run produced
  // nothing, so offering to repeat it reads as though it worked the first
  // time, and forcing past a cache that holds nothing is pointless besides.
  const done = job?.status === "succeeded";

  const run = (force: boolean) => start(async () => {
    setError("");
    const answer = await runAiAction({
      slug, feature, listId, opponent, opponentProfileId, force });
    if (answer.error) return setError(answer.error);
    if (answer.jobId) setJobId(answer.jobId);
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

      {job?.status === "succeeded" ? (
        <Stack spacing={2}>
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
