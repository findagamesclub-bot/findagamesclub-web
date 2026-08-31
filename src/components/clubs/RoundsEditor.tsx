"use client";

import { startTransition, useActionState, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { competitionAction, type CompetitionState }
  from "@/app/clubs/[slug]/competitions/actions";
import { shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CompetitionUpdate } from "@/types/competition";

type Match = { playerOne: string; playerOneScore: string;
               playerTwo: string; playerTwoScore: string };

/**
 * The rounds, and the games in each.
 *
 * One accordion per round because a season has a dozen of them and only one is
 * ever being edited. A new round opens as a blank panel at the top rather than
 * a separate dialog: what you are adding is the same shape as what is already
 * there, so it should look the same.
 */
export default function RoundsEditor({
  competitionId, slug, faction, rounds,
}: {
  competitionId: number;
  slug: string;
  faction: Faction;
  rounds: CompetitionUpdate[];
}) {
  const [state, submit, busy] = useActionState<CompetitionState, FormData>(
    competitionAction, {});
  useActionToast(state);

  const [drafts, setDrafts] = useState<Record<number, Match[]>>({});
  const [adding, setAdding] = useState(false);
  const [newMatches, setNewMatches] = useState<Match[]>([]);
  const [dropping, setDropping] = useState<CompetitionUpdate | null>(null);

  const matchesFor = (round: CompetitionUpdate): Match[] =>
    drafts[round.id] ?? round.matches.map((m) => ({ ...m }));

  const setMatches = (id: number, next: Match[]) =>
    setDrafts((prev) => ({ ...prev, [id]: next }));

  const saveRound = (form: HTMLFormElement, roundId: number | null, matches: Match[]) => {
    const data = new FormData(form);
    data.set("intent", "round");
    data.set("slug", slug);
    data.set("competitionId", String(competitionId));
    if (roundId) data.set("roundId", String(roundId));
    data.set("position", String(rounds.length));
    data.set("matches", JSON.stringify(matches));
    startTransition(() => submit(data));
    if (!roundId) { setAdding(false); setNewMatches([]); }
  };

  const dropRound = () => {
    if (!dropping) return;
    const data = new FormData();
    data.set("intent", "delete-round");
    data.set("slug", slug);
    data.set("competitionId", String(competitionId));
    data.set("roundId", String(dropping.id));
    startTransition(() => submit(data));
    setDropping(null);
  };

  return (
    <Stack spacing={2}>
      {!adding ? (
        <Button variant="outlined" startIcon={<AddIcon />} disabled={busy}
          onClick={() => setAdding(true)}
          sx={{ alignSelf: "flex-start", mb: 1, color: tokens.ink,
                borderColor: tokens.rule }}>
          Add a round
        </Button>
      ) : (
        <Accordion expanded disableGutters
          sx={{ border: `1px solid ${faction.base}`, borderRadius: 1.5, mb: 1,
                backgroundColor: tokens.paper, boxShadow: "none",
                "&::before": { display: "none" } }}>
          <AccordionSummary>
            <Typography variant="subtitle2">New round</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <form onSubmit={(e) => { e.preventDefault(); saveRound(e.currentTarget, null, newMatches); }}>
              <RoundFields matches={newMatches} onMatches={setNewMatches} busy={busy}
                faction={faction} onCancel={() => { setAdding(false); setNewMatches([]); }} />
            </form>
          </AccordionDetails>
        </Accordion>
      )}

      {rounds.map((round) => (
        <Accordion key={round.id} disableGutters
          sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                backgroundColor: tokens.paper, boxShadow: "none",
                "&::before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", flex: 1 }}>
              <Typography variant="subtitle2">{round.title || "Untitled round"}</Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted }}>
                {[round.postedOn ? shortDate(round.postedOn) : null,
                  `${round.matches.length} ${round.matches.length === 1 ? "game" : "games"}`]
                  .filter(Boolean).join(" · ").toUpperCase()}
              </Typography>
            </Stack>
          </AccordionSummary>

          <AccordionDetails>
            <form onSubmit={(e) => {
              e.preventDefault();
              saveRound(e.currentTarget, round.id, matchesFor(round));
            }}>
              <RoundFields
                round={round}
                matches={matchesFor(round)}
                onMatches={(next) => setMatches(round.id, next)}
                busy={busy}
                faction={faction}
                onDelete={() => setDropping(round)}
              />
            </form>
          </AccordionDetails>
        </Accordion>
      ))}

      <ConfirmDialog
        open={Boolean(dropping)}
        title="Remove this round?"
        body={dropping
          ? `"${dropping.title || "Untitled round"}" and its ${dropping.matches.length} `
            + "game results will be removed from the club page. The table is not changed."
          : ""}
        confirmLabel="Remove it"
        cancelLabel="Keep it"
        destructive
        busy={busy}
        onConfirm={dropRound}
        onClose={() => setDropping(null)}
      />
    </Stack>
  );
}

/** The fields, shared by the new-round panel and every existing one. */
function RoundFields({
  round, matches, onMatches, busy, faction, onCancel, onDelete,
}: {
  round?: CompetitionUpdate;
  matches: Match[];
  onMatches: (next: Match[]) => void;
  busy: boolean;
  faction: Faction;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const patch = (index: number, change: Partial<Match>) =>
    onMatches(matches.map((m, i) => (i === index ? { ...m, ...change } : m)));

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField name="title" label="Round" size="small" fullWidth
          defaultValue={round?.title ?? ""} placeholder="Round 3"
          slotProps={{ htmlInput: { maxLength: 160 } }} />
        <TextField name="postedOn" type="date" label="Played on" size="small" fullWidth
          defaultValue={round?.postedOn ?? ""}
          slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>

      <TextField name="summary" label="How it went" size="small" multiline minRows={2}
        fullWidth defaultValue={round?.summary ?? ""}
        helperText="Optional. A line or two for the club page."
        slotProps={{ htmlInput: { maxLength: 2000 } }} />

      <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", letterSpacing: "0.12em",
                        color: tokens.inkMuted, fontWeight: 700 }}>
        GAMES IN THIS ROUND
      </Typography>

      {matches.map((match, index) => (
        <Stack key={index} direction="row" spacing={1}
          sx={{ alignItems: "center", flexWrap: { xs: "wrap", md: "nowrap" } }}>
          <TextField size="small" label="Player" value={match.playerOne}
            onChange={(e) => patch(index, { playerOne: e.target.value })} sx={{ flex: 1 }} />
          <TextField size="small" label="Score" value={match.playerOneScore}
            onChange={(e) => patch(index, { playerOneScore: e.target.value })}
            sx={{ width: 84 }} />
          <Typography sx={{ color: tokens.inkMuted }}>v</Typography>
          <TextField size="small" label="Score" value={match.playerTwoScore}
            onChange={(e) => patch(index, { playerTwoScore: e.target.value })}
            sx={{ width: 84 }} />
          <TextField size="small" label="Player" value={match.playerTwo}
            onChange={(e) => patch(index, { playerTwo: e.target.value })} sx={{ flex: 1 }} />
          <IconButton size="small" aria-label={`Remove game ${index + 1}`}
            onClick={() => onMatches(matches.filter((_, i) => i !== index))}>
            <DeleteOutlinedIcon sx={{ fontSize: 18, color: tokens.inkMuted }} />
          </IconButton>
        </Stack>
      ))}

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Button size="small" variant="text" startIcon={<AddIcon />}
          onClick={() => onMatches([...matches, {
            playerOne: "", playerOneScore: "", playerTwo: "", playerTwoScore: "",
          }])}>
          Add a game
        </Button>

        <Button type="submit" variant="contained" size="small"
          loading={busy} loadingPosition="start"
          sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}>
          Save the round
        </Button>

        {onCancel ? (
          <Button size="small" variant="text" onClick={onCancel} disabled={busy}>Cancel</Button>
        ) : null}

        {onDelete ? (
          <Button size="small" variant="text" onClick={onDelete} disabled={busy}
            sx={{ ml: "auto", color: tokens.inkMuted,
                  "&:hover": { color: tokens.danger, backgroundColor: "transparent" } }}>
            Remove this round
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
