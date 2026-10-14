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
import { useActionSuccess } from "@/hooks/useActionSuccess";
import Autocomplete from "@mui/material/Autocomplete";
import Tooltip from "@mui/material/Tooltip";
import SportsEsportsIcon from "@mui/icons-material/SportsEsportsOutlined";
import GameResultDialog, { type GameResultFields }
  from "@/components/results/GameResultDialog";
import type { Builder, MemberList } from "@/services/resultArmies.service";
import type { GameSide } from "@/utils/result-army";
import type { MatchSetup } from "@/utils/result-meta";
import type { Person } from "@/components/bookings/OpponentField";
import { competitionAction, type CompetitionState }
  from "@/app/clubs/[slug]/(console)/competitions/actions";
import { shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CompetitionUpdate } from "@/types/competition";

type Match = {
  /** 0 on a game being added. A saved game keeps its id, and its armies. */
  id: number;
  playerOne: string; playerOneScore: string; playerOneId: string | null;
  playerTwo: string; playerTwoScore: string; playerTwoId: string | null;
};

const BLANK: Match = {
  id: 0,
  playerOne: "", playerOneScore: "", playerOneId: null,
  playerTwo: "", playerTwoScore: "", playerTwoId: null,
};

/**
 * The rounds, and the games in each.
 *
 * One accordion per round because a season has a dozen of them and only one is
 * ever being edited. A new round opens as a blank panel at the top rather than
 * a separate dialog: what you are adding is the same shape as what is already
 * there, so it should look the same.
 */
export default function RoundsEditor({
  competitionId, slug, faction, rounds, roster, builder, lists, armies, setup,
}: {
  competitionId: number;
  slug: string;
  faction: Faction;
  rounds: CompetitionUpdate[];
  /** The club's own members, for naming the account behind a player. */
  roster: Person[];
  /** Null at a club that does not record armies, which hides all of that. */
  builder: Builder | null;
  lists: MemberList[];
  /** What is already recorded, keyed `<gameId>:<side>`. */
  armies: Record<string, GameSide>;
  /** How each game was set up, by game id. */
  setup: Record<number, MatchSetup>;
}) {
  const [state, submit, busy] = useActionState<CompetitionState, FormData>(
    competitionAction, {});
  useActionToast(state);

  const [drafts, setDrafts] = useState<Record<number, Match[]>>({});
  const [adding, setAdding] = useState(false);
  const [newMatches, setNewMatches] = useState<Match[]>([]);
  const [dropping, setDropping] = useState<CompetitionUpdate | null>(null);
  const [playing, setPlaying] = useState<Match | null>(null);

  // Every dialog here closes when the answer lands, never on the click.
  useActionSuccess(state, () => { setPlaying(null); setDropping(null); });

  const matchesFor = (round: CompetitionUpdate): Match[] =>
    drafts[round.id] ?? round.matches.map((m) => ({
      id: m.id,
      playerOne: m.playerOne, playerOneScore: m.playerOneScore,
      playerOneId: m.playerOneId,
      playerTwo: m.playerTwo, playerTwoScore: m.playerTwoScore,
      playerTwoId: m.playerTwoId,
    }));

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
                faction={faction} roster={roster}
                onCancel={() => { setAdding(false); setNewMatches([]); }} />
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
                roster={roster}
                onPlayed={builder ? setPlaying : undefined}
                armyOn={(id) => Boolean(armies[`${id}:one`] || armies[`${id}:two`])}
                onDelete={() => setDropping(round)}
              />
            </form>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* The same dialog a table of the draw uses. A league game and a
          tournament table are the same question, which is how the client
          asked it: the same options as a regular table booking game. */}
      <GameResultDialog
        game={playing ? {
          id: playing.id,
          playerOne: playing.playerOne, playerOneId: playing.playerOneId,
          playerTwo: playing.playerTwo, playerTwoId: playing.playerTwoId,
        } : null}
        title={playing ? `${playing.playerOne} v ${playing.playerTwo}` : ""}
        builder={builder} lists={lists}
        recorded={armies} setup={setup} saving={busy}
        onClose={() => setPlaying(null)}
        onSave={(fields: GameResultFields) => {
          const data = new FormData();
          data.set("intent", "game-result");
          data.set("slug", slug);
          data.set("competitionId", String(competitionId));
          for (const [key, value] of Object.entries(fields)) data.set(key, value);
          startTransition(() => submit(data));
        }} />

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
  round, matches, onMatches, busy, faction, roster, onPlayed, armyOn,
  onCancel, onDelete,
}: {
  round?: CompetitionUpdate;
  matches: Match[];
  onMatches: (next: Match[]) => void;
  busy: boolean;
  faction: Faction;
  roster: Person[];
  /** Absent at a club that does not record armies. */
  onPlayed?: (match: Match) => void;
  armyOn?: (id: number) => boolean;
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
        <Stack key={match.id || `new-${index}`} direction="row" spacing={1}
          sx={{ alignItems: "center", flexWrap: { xs: "wrap", md: "nowrap" } }}>
          <PlayerBox roster={roster} name={match.playerOne} id={match.playerOneId}
            onChange={(name, id) => patch(index, { playerOne: name, playerOneId: id })} />
          <TextField size="small" label="Score" value={match.playerOneScore}
            onChange={(e) => patch(index, { playerOneScore: e.target.value })}
            sx={{ width: 84 }} />
          <Typography sx={{ color: tokens.inkMuted }}>v</Typography>
          <TextField size="small" label="Score" value={match.playerTwoScore}
            onChange={(e) => patch(index, { playerTwoScore: e.target.value })}
            sx={{ width: 84 }} />
          <PlayerBox roster={roster} name={match.playerTwo} id={match.playerTwoId}
            onChange={(name, id) => patch(index, { playerTwo: name, playerTwoId: id })} />

          {/* A game has to exist before what was played in it can hang off
              it: the army rows are keyed on the game's own id. Same rule the
              draw states in its own words. */}
          {onPlayed ? (
            <Tooltip title={match.id
              ? "What was played"
              : "Save the round first, then say what was played."}>
              <span>
                <IconButton size="small" disabled={!match.id}
                  aria-label={`What was played in game ${index + 1}`}
                  onClick={() => onPlayed(match)}>
                  <SportsEsportsIcon sx={{ fontSize: 19,
                    color: armyOn?.(match.id) ? faction.base : tokens.inkMuted }} />
                </IconButton>
              </span>
            </Tooltip>
          ) : null}

          <IconButton size="small" aria-label={`Remove game ${index + 1}`}
            onClick={() => onMatches(matches.filter((_, i) => i !== index))}>
            <DeleteOutlinedIcon sx={{ fontSize: 18, color: tokens.inkMuted }} />
          </IconButton>
        </Stack>
      ))}

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Button size="small" variant="text" startIcon={<AddIcon />}
          onClick={() => onMatches([...matches, { ...BLANK }])}>
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


/**
 * A player's name, and the account behind it where there is one.
 *
 * freeSolo, because most names in a league table are typed: a club runs an
 * open ladder and half the field has never logged in. Naming a member is what
 * makes the game count on their profile and in the Meta Tracker, which is why
 * the picker is here at all, and the client asked for it in those words: "the
 * club player name does not autofill based on the club member list".
 *
 * `onInputChange` with `reason === "input"` is what unlinks on a keystroke.
 * `onChange` fires on a selection and on a clear and never on typing, which
 * is the trap 0178 paid for: typing a guest's name over a picked member kept
 * the member's uuid and the game was filed under the wrong person.
 */
function PlayerBox({
  roster, name, id, onChange,
}: {
  roster: Person[];
  name: string;
  id: string | null;
  onChange: (name: string, id: string | null) => void;
}) {
  return (
    <Autocomplete<Person, false, false, true>
      freeSolo
      options={roster}
      sx={{ flex: 1, minWidth: 150 }}
      value={id ? roster.find((p) => p.id === id) ?? name : name}
      getOptionLabel={(option) => typeof option === "string" ? option : option.name}
      isOptionEqualToValue={(a, b) =>
        typeof a !== "string" && typeof b !== "string" && a.id === b.id}
      onChange={(_event, value) => {
        if (typeof value === "string" || !value) onChange(value ?? "", null);
        else onChange(value.name, value.id);
      }}
      onInputChange={(_event, value, reason) => {
        if (reason === "input") onChange(value, null);
      }}
      renderInput={(params) => (
        <TextField {...params} size="small" label="Player" />
      )}
    />
  );
}
