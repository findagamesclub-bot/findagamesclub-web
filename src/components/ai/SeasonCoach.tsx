"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddIcon from "@mui/icons-material/Add";
import LinkButton from "@/components/ui/LinkButton";
import AiNote from "./AiNote";
import AiJobProgress from "./AiJobProgress";
import AiResult from "./AiResult";
import AiResultHeader from "./AiResultHeader";
import { useAiJob } from "@/hooks/useAiJob";
import { runSeasonAction, seasonHistoryAction } from "@/app/clubs/[slug]/(console)/army-builder/season-actions";
import { SEASON_GOALS } from "@/utils/season-goals";
import { aiErrorCopy } from "@/utils/ai-errors";
import { shortDate } from "@/utils/dates";
import { AI_DEPLOYMENT_COPY, type AiDeployment } from "@/utils/ai-deployment";
import type { AiJob } from "@/types/ai";
import { mono, tokens } from "@/lib/tokens";

export type ListOption = { id: number; name: string; faction: string };

/**
 * A plan for one list and one goal.
 *
 * Its own component rather than `AiPanel`, because the question has two parts
 * and the goal is half of it: the same list with "improve results" and with
 * "prepare next games" are two plans, both worth having, and both kept.
 */
export default function SeasonCoach({
  slug, lists, reason, usage, initial, stale, deployment,
}: {
  /** Whether this site can run it at all. Checked before the tier. */
  deployment: AiDeployment;
  slug: string;
  lists: ListOption[];
  reason: string | null;
  usage: { message: string; limited: boolean };
  initial: AiJob | null;
  /** Why the plan on file has been overtaken, if it has. */
  stale: string;
}) {
  const [busy, start] = useTransition();
  const [listId, setListId] = useState<number | "">(lists[0]?.id ?? "");
  const [goal, setGoal] = useState<string>(SEASON_GOALS[0].id);
  const [jobId, setJobId] = useState<number | null>(
    initial && initial.status !== "failed" ? initial.id : null);
  const [error, setError] = useState("");
  // Every plan this reader has had for this list and this goal. The rows have
  // been in the table since 0146 and this screen could not reach them, so a
  // spent allowance meant a blank page with an apology on it. Item 8.
  const [history, setHistory] = useState<
    { id: number; at: string; model: string }[]>([]);
  // Whether what is on screen was written by the press that put it there.
  const [saved, setSaved] = useState(Boolean(initial));

  const live = useAiJob(jobId);
  const job = live.data ?? (jobId === initial?.id ? initial : null);
  const running = job?.status === "queued" || job?.status === "running";
  const done = job?.status === "succeeded";

  // Set inside the promise's callback rather than the effect body, which is
  // what `react-hooks/set-state-in-effect` asks for, and dropped when the
  // reader has already moved to a different list or goal.
  const load = useCallback(() => {
    if (listId === "") return undefined;
    let alive = true;
    seasonHistoryAction({ slug, listId: Number(listId), goal })
      .then((answer) => { if (alive) setHistory(answer.jobs ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug, listId, goal]);

  useEffect(() => {
    if (reason || deployment !== "on") return;
    return load();
  }, [load, reason, deployment]);

  const run = () => start(async () => {
    setError("");
    if (listId === "") return setError("Choose a list to plan around.");
    const answer = await runSeasonAction({
      slug, listId: Number(listId), goal, force: done });
    if (answer.error) return setError(answer.error);
    if (answer.jobId) {
      setSaved(false);
      setJobId(answer.jobId);
      load();
    }
  });

  if (deployment !== "on") {
    return <AiNote kind="note">{AI_DEPLOYMENT_COPY[deployment]}</AiNote>;
  }

  if (reason) return <AiNote>{reason}</AiNote>;

  if (!lists.length) {
    // Telling somebody to build a list and giving them no way to build one is
    // the same dead end the shelf had before it got a breadcrumb. A clubmate's
    // lists do not count here: a plan is about what you are taking.
    return (
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          A season plan is advice about something you are actually taking to
          games, so it needs a list of your own. Your clubmates&apos; lists do
          not count.
        </Typography>
        <LinkButton variant="contained" startIcon={<AddIcon />}
          href={`/clubs/${slug}/army-builder/new`}>
          Build a list
        </LinkButton>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
        sx={{ maxWidth: 820 }}>
        <TextField select fullWidth label="Plan around" value={listId}
          onChange={(event) => setListId(Number(event.target.value))}>
          {lists.map((one) => (
            <MenuItem key={one.id} value={one.id}>
              {`${one.name} · ${one.faction}`}
            </MenuItem>
          ))}
        </TextField>
        <TextField select fullWidth label="What you are after" value={goal}
          onChange={(event) => setGoal(event.target.value)}
          helperText={SEASON_GOALS.find((one) => one.id === goal)?.description}>
          {SEASON_GOALS.map((one) => (
            <MenuItem key={one.id} value={one.id}>{one.label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {stale && done ? (
        <Alert severity="info">
          {`${stale} The plan below is still here; run it again to bring it up to date.`}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Button variant="contained" startIcon={<AutoAwesomeIcon />}
          loading={busy} loadingPosition="start"
          disabled={running || usage.limited} onClick={run}>
          {done ? "Build it again" : "Build a season plan"}
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

      {/* The plans before this one, which is the half somebody whose
          allowance has run out actually needs: the button is disabled and
          this is the only way back to what they already paid for. */}
      {history.length > 1
        || (history.length === 1 && history[0]!.id !== jobId) ? (
        <Stack spacing={0.75}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.08em", color: tokens.inkMuted }}>
            EARLIER PLANS
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

      {done ? (
        <Stack spacing={2}>
          {saved ? (
            <AiNote kind="note">
              {"This is the season plan saved on "}
              {shortDate(job.finishedAt ?? job.createdAt)}
              {". It was not built again. Press Build it again for a fresh one, "}
              {"which is saved beside this one rather than replacing it."}
            </AiNote>
          ) : null}
          <AiResultHeader model={job.model} at={job.finishedAt ?? job.createdAt}
            about={String((job.source as { listName?: string })?.listName ?? "")} />
          <AiResult feature="season" result={job.result} />
        </Stack>
      ) : null}
    </Stack>
  );
}
