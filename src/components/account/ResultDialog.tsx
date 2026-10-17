"use client";

import { useActionState, useState, useTransition } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { recordResultAction, clearResultAction, type ResultState }
  from "@/app/account/games/actions";
import MatchContextFields from "./MatchContextFields";
import ArmyFields from "@/components/results/ArmyFields";
import ArmyListPicker from "@/components/results/ArmyListPicker";
import GameField from "@/components/results/GameField";
import { useCatalogue } from "@/hooks/useCatalogue";
import { type GameSide } from "@/utils/result-army";
import type { MemberList } from "@/services/resultArmies.service";
import { confirmationLabel, toConfirmation } from "@/utils/result-meta";
import { playsFortyK } from "@/utils/event-meta";
import { knownGames } from "@/utils/game-label";
import { mono, tokens } from "@/lib/tokens";
import type { MyGame } from "@/services/games.service";

/**
 * Enter what happened.
 *
 * Always "you" on the left and them on the right, whoever booked the table.
 * The row underneath stores it in the booking's own order; turning it round is
 * the service's job, so neither player has to think about who booked.
 */
export default function ResultDialog({
  game, canManageClub = false, myLists = [],
}: {
  game: MyGame;
  /** The club may set the result state, and may edit a settled one. */
  canManageClub?: boolean;
  /**
   * Their own saved lists at this club, so they can say which one they
   * brought.
   *
   * Only theirs, and only their own side of the result: `link_result_army_list`
   * refuses anything else, because on a club night the only person who knows
   * which list came out of the bag is the person who built it. The opponent
   * names theirs from their own copy of this game.
   */
  myLists?: MemberList[];
}) {
  // Wider than the rest of the site's dialogs, and the whole screen on a
  // phone. A result is eleven fields per side once the army is open, and at
  // 600px the cascade read as a column of boxes with no relationship to each
  // other. Rule 5: editing goes in a dialog, and a dialog that has to hold a
  // form gets the room for it.
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [open, setOpen] = useState(false);

  // Started from what was recorded, never from an empty army: saving an empty
  // one deletes the row, so a dialog that forgot last week's army would throw
  // it away the moment somebody corrected a score.
  const [mine, setMine] = useState<GameSide>(game.armies.mine);
  const [theirs, setTheirs] = useState<GameSide>(game.armies.theirs);
  const [mission, setMission] = useState(game.mission);
  const [deployment, setDeployment] = useState(game.deployment);
  const [terrain, setTerrain] = useState(game.terrain);
  const [confirmation, setConfirmation] = useState(game.confirmation);
  const [title, setTitle] = useState(game.gameTitle);

  /**
   * Take the server's version whenever this is shut.
   *
   * Every one of these is a `useState` initialiser, which runs once when the
   * card mounts and never again. This dialog is mounted for every game on the
   * page, so a result somebody else changed -- the club settling it, the other
   * player correcting it -- never reached the fields: the page re-rendered with
   * the new data and the dialog went on showing what it captured at load. It
   * cost a disposition the club had set and would have written the stale value
   * back on the next save.
   *
   * Only while closed, because adopting new props under somebody who is typing
   * would throw their work away. `game` is a fresh object on every server
   * render, so the reference is the signal that something arrived.
   */
  const [seen, setSeen] = useState(game);
  if (!open && seen !== game) {
    setSeen(game);
    setMine(game.armies.mine);
    setTheirs(game.armies.theirs);
    setMission(game.mission);
    setDeployment(game.deployment);
    setTerrain(game.terrain);
    setConfirmation(game.confirmation);
    setTitle(game.gameTitle);
  }

  // Settled or disputed results belong to the club. Saying so up front beats a
  // form that accepts your typing and then refuses on save.
  const readOnly = game.locked && !canManageClub;

  // Fetched on the first open rather than shipped with the page. A club that
  // does not run the builder has no builder to fetch, and sees the two free
  // text boxes it has always seen.
  const { catalogue, loading, failed } = useCatalogue(game.builder, open);

  // The army half belongs to Warhammer 40,000, because the catalogue it reads
  // is 40k's. Anything else, and the fields come off: the service clears what
  // was recorded as well, so a game changed from 40k does not keep a faction
  // nobody can see. `canonicalGame` inside `playsFortyK` is what makes
  // "warhammer 40k" and "Warhammer 40,000" the same answer.
  const isFortyK = playsFortyK([title]);

  const [state, submit, busy] = useActionState<ResultState, FormData>(recordResultAction, {});
  const [clearState, clear, clearing] = useActionState<ResultState, FormData>(clearResultAction, {});

  // Clearing is dispatched from a click rather than through a form action, so
  // it needs a transition. Without one React warns and `clearing` never flips,
  // which means the button's spinner never shows.
  const [, startClear] = useTransition();
  useActionToast(state);
  useActionToast(clearState);

  /**
   * Close on success, stay open on a refusal.
   *
   * This used to close on click, before the save had run, so a refused save
   * threw away everything typed and left only a toast. Derived during render
   * rather than in an effect: an effect would close it a frame later and trip
   * the set-state-in-effect rule.
   */
  useActionSuccess(state, () => setOpen(false));
  useActionSuccess(clearState, () => setOpen(false));

  const done = game.myScore !== null;

  /**
   * Naming a list fills the cascade in.
   *
   * A list already says its faction, detachment and disposition, and typing
   * them again is two chances to disagree with it. It also matters on save:
   * an empty army writes no row, and a list hangs off that row, so a list
   * named against nothing would have nowhere to go.
   */
  const pickList = (list: MemberList | null) => {
    if (!list) { setMine({ ...mine, listId: null, listName: "" }); return; }
    setMine({ ...mine, listId: list.id, listName: list.name,
              factionId: list.factionId, factionLabel: list.faction,
              detachment: list.detachment, disposition: list.disposition });
  };

  return (
    <>
      <Button size="small" variant={done ? "text" : "outlined"}
        startIcon={<EditNoteIcon sx={{ fontSize: 17 }} />}
        onClick={() => setOpen(true)}
        sx={done ? undefined : { color: tokens.ink, borderColor: tokens.brass }}>
        {done ? "Edit result" : "Add the result"}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 2 } } }}>
        <DialogTitle sx={{ fontSize: "1.25rem" }}>
          {game.title}
          <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
            {`${game.club.name.toUpperCase()} · VS ${game.opponentName.toUpperCase()}`}
            {game.myScore !== null ? ` · ${confirmationLabel(game.confirmation).toUpperCase()}` : ""}
          </Typography>
        </DialogTitle>

        <form action={submit}>
          <input type="hidden" name="bookingId" value={game.id} />
          <input type="hidden" name="iBooked" value={String(game.iBooked)} />
          <input type="hidden" name="mission" value={mission} />
          <input type="hidden" name="deployment" value={deployment} />
          <input type="hidden" name="terrain" value={terrain} />
          <input type="hidden" name="confirmation" value={canManageClub ? confirmation : ""} />
          <input type="hidden" name="game" value={title} />

          <DialogContent dividers>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={2}>
                <TextField name="myScore" label="Your score" type="number" fullWidth
                  defaultValue={game.myScore ?? ""} autoFocus
                  slotProps={{ htmlInput: { min: 0, step: "0.5" } }} />
                <TextField name="theirScore" label={`${game.opponentName}'s score`}
                  type="number" fullWidth defaultValue={game.theirScore ?? ""}
                  slotProps={{ htmlInput: { min: 0, step: "0.5" } }} />
              </Stack>

              {/* In front of the army fields, because it is what decides
                  whether they appear. A club night is one table and one game,
                  and the game was typed when the table was booked, so this
                  opens with that and is usually left alone. */}
              <GameField value={title} recorded={game.gameTitle} options={knownGames()}
                onChange={setTitle} disabled={readOnly}
                revealsArmy={game.builder !== null}
                hasArmy={Boolean(game.armies.mine.factionId || game.armies.theirs.factionId
                  || game.myArmy || game.theirArmy)}
                hasSetup={Boolean(mission || deployment || terrain)} />

              {/* Two switches, not one. The club decides whether it records
                  armies at all; the game decides whether these particular
                  fields mean anything. A club that plays 40k on Thursdays and
                  Blood Bowl on Tuesdays was being asked for a detachment on
                  both, which is the client's own example. */}
              <ArmyFields
                builder={isFortyK ? game.builder : null} catalogue={catalogue}
                loading={loading} failed={failed}
                one={mine} two={theirs}
                // Spread over what is held rather than replaced, so the
                // list named above survives a change to the cascade under it.
                // The same shape the league dialog uses.
                onOne={(next) => setMine({ ...mine, ...next })}
                onTwo={(next) => setTheirs({ ...theirs, ...next })}
                twoTitle={`${game.opponentName}'s army`}
                underOne={(
                  <>
                    {/* Inside the slot on purpose: it renders only once the
                        catalogue is in, so a club with the builder off posts
                        no field at all and any link is left alone. */}
                    <input type="hidden" name="myList"
                      value={mine.listId === null ? "" : String(mine.listId)} />
                    <ArmyListPicker lists={myLists} playerNamed unnamedNote=""
                      label="Your army list"
                      emptyNote="You have not built an army list at this club yet. Build one in the Army Builder and you can name it here."
                      value={mine.listId} disabled={readOnly}
                      onChange={pickList} />
                  </>
                )}
                underTwo={<TheirList name={game.opponentName}
                  listName={theirs.listName} hasAccount={Boolean(game.opponentId)} />}
                fallback={isFortyK ? (
                  <Stack direction="row" spacing={2}>
                    <TextField name="myArmy" label="Your army" fullWidth
                      defaultValue={game.myArmy} placeholder="Death Guard" />
                    <TextField name="theirArmy" label="Their army" fullWidth
                      defaultValue={game.theirArmy} placeholder="Custodes" />
                  </Stack>
                ) : null}
              />

              <MatchContextFields
                mission={mission} deployment={deployment} terrain={terrain}
                confirmation={confirmation} canManageClub={canManageClub}
                recordsSetup={isFortyK}
                onMission={setMission} onDeployment={setDeployment}
                onTerrain={setTerrain}
                onConfirmation={(value) => setConfirmation(toConfirmation(value))}
              />

              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {readOnly
                  ? "The club has settled this result, so it can no longer be changed here."
                  : game.confirmation === "confirmed"
                    ? "Both players have agreed this. Editing it puts it back to submitted."
                    : "Either player can record this, and either can correct it. Everything but the scores is optional."}
              </Typography>
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2 }}>
            {done ? (
              <Button type="button" variant="text" loading={clearing}
                disabled={clearing || busy || readOnly}
                onClick={() => {
                  const data = new FormData();
                  data.set("bookingId", String(game.id));
                  startClear(() => clear(data));
                }}
                sx={{ color: tokens.danger, mr: "auto" }}>
                Clear it
              </Button>
            ) : null}
            {/* Closing mid-save would lose the typing if the save is refused. */}
            <Button type="button" variant="text" disabled={busy || clearing}
              onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={busy}
              loadingPosition="start" disabled={readOnly || clearing}>
              Save result
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

/**
 * What the other side brought, read-only.
 *
 * A list belongs to whoever built it, so this is a sentence and not a control:
 * 0145 refuses anybody but the owner of that side. Without it the dialog
 * offers a picker under one army and nothing at all under the other, which
 * reads as the feature being half-built rather than as a rule.
 */
function TheirList({ name, listName, hasAccount }: {
  name: string; listName: string; hasAccount: boolean;
}) {
  const said = listName.trim();
  return (
    <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
      {said
        ? `They named ${said}.`
        : hasAccount
          ? `Only ${name} can name the list they brought, from their own copy of this game.`
          : `${name} is not linked to a member account, so there is no saved list to name.`}
    </Typography>
  );
}
