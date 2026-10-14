"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { useCatalogue } from "@/hooks/useCatalogue";
import ArmyResultFields from "./ArmyResultFields";
import ArmyListPicker from "./ArmyListPicker";
import MatchContextFields from "@/components/account/MatchContextFields";
import { EMPTY_SIDE, type GameSide } from "@/utils/result-army";
import { tokens } from "@/lib/tokens";
import type { Builder, MemberList } from "@/services/resultArmies.service";
import type { MatchSetup } from "@/utils/result-meta";

/** The one game this dialog is about, whoever is holding it. */
export type GameUnderEdit = {
  id: number;
  playerOne: string;
  playerOneId: string | null;
  playerTwo: string;
  playerTwoId: string | null;
};

export type GameResultFields = Record<string, string>;

/**
 * What was played in one game, wherever the game was played.
 *
 * One dialog for a table of a draw and for a game in a league round, because
 * they are the same question and the client asked it as one: "you should get
 * the same options as the regular table booking game". Before this a booking
 * recorded nine things per side and the setup, a table of a draw recorded
 * three, and a league game recorded nothing at all. `put_result_army` has
 * accepted the full shape since 0135, so two of those three were screens
 * sending a fraction of what the database would take.
 *
 * `ArmyResultFields` is the booking's own per-side editor and is used here
 * unchanged, so the three screens cannot drift into three sets of boxes. The
 * setup is `MatchContextFields` with the result state left off: that is the
 * club's ruling on a game somebody else reported, and a round typed up by the
 * organiser has no such thing to rule on.
 *
 * Nothing here is required. A tournament that collects lists fills both sides
 * in; one that does not records the scores and leaves this alone.
 */
export default function GameResultDialog({
  game, title, builder, lists, recorded, setup, saving, onClose, onSave,
}: {
  /** Null keeps this shut. */
  game: GameUnderEdit | null;
  /** "Table 4" at an event, "Game 2" in a league round. */
  title: string;
  builder: Builder | null;
  lists: MemberList[];
  /** What is already recorded, keyed `<gameId>:<side>`. */
  recorded: Record<string, GameSide>;
  /** How the game was set up, by game id. */
  setup: Record<number, MatchSetup>;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: GameResultFields) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("md"));
  const { catalogue, loading, failed } = useCatalogue(builder, game !== null);

  const [one, setOne] = useState<GameSide>(EMPTY_SIDE);
  const [two, setTwo] = useState<GameSide>(EMPTY_SIDE);
  const [mission, setMission] = useState("");
  const [deployment, setDeployment] = useState("");
  const [terrain, setTerrain] = useState("");

  // During render, so opening the next game never paints the last one's army.
  useWhenChanged([game?.id], () => {
    const held = (side: string): GameSide =>
      (game ? recorded[`${game.id}:${side}`] : undefined) ?? EMPTY_SIDE;
    setOne(held("one"));
    setTwo(held("two"));
    const was = game ? setup[game.id] : undefined;
    setMission(was?.mission ?? "");
    setDeployment(was?.deployment ?? "");
    setTerrain(was?.terrain ?? "");
  });

  // A list already says which army it is, so naming one answers the cascade
  // rather than asking for it twice.
  const pickList = (
    value: GameSide, set: (next: GameSide) => void,
  ) => (list: MemberList | null) => {
    if (!list) { set({ ...value, listId: null }); return; }
    set({ ...value, listId: list.id, listName: list.name,
          factionId: list.factionId, factionLabel: list.faction,
          detachment: list.detachment, disposition: list.disposition });
  };

  const send = () => onSave({
    gameId: String(game?.id ?? 0),
    // A form cannot post a shape and two armies are a shape, which is why the
    // booking's own fields do the same thing.
    armies: JSON.stringify({ one, two }),
    oneList: one.listId === null ? "" : String(one.listId),
    twoList: two.listId === null ? "" : String(two.listId),
    mission, deployment, terrain,
  });

  const bye = !game?.playerTwo.trim();

  return (
    <Dialog open={game !== null} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
            Loading the catalogue.
          </Typography>
        ) : failed || !catalogue ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
            The army catalogue would not load, so there is nothing to pick from.
            The scores on this game are not affected.
          </Typography>
        ) : (
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Box sx={{ display: "grid", gap: 3, alignItems: "start",
                       gridTemplateColumns: { xs: "1fr", md: bye ? "1fr" : "1fr 1fr" } }}>
              <Stack spacing={2}>
                <ArmyResultFields title={game?.playerOne || "Player one"}
                  catalogue={catalogue}
                  value={one}
                  onChange={(next) => setOne({ ...one, ...next })} />
                <ArmyListPicker lists={lists}
                  playerNamed={Boolean(game?.playerOneId)}
                  value={one.listId} onChange={pickList(one, setOne)}
                  unnamedNote={game?.playerOne
                    ? `${game.playerOne} is not linked to a member account, so there is no saved list to name.`
                    : ""} />
              </Stack>

              {bye ? null : (
                <Stack spacing={2}>
                  <ArmyResultFields title={game?.playerTwo || "Player two"}
                    catalogue={catalogue}
                    value={two}
                    onChange={(next) => setTwo({ ...two, ...next })} />
                  <ArmyListPicker lists={lists}
                    playerNamed={Boolean(game?.playerTwoId)}
                    value={two.listId} onChange={pickList(two, setTwo)}
                    unnamedNote={game?.playerTwo
                      ? `${game.playerTwo} is not linked to a member account, so there is no saved list to name.`
                      : ""} />
                </Stack>
              )}
            </Box>

            {/* One setup for the game, not one per side: both players were in
                the same deployment. The result state is deliberately absent,
                which is what `canManageClub={false}` turns off here. */}
            <MatchContextFields
              mission={mission} deployment={deployment} terrain={terrain}
              confirmation="" canManageClub={false} recordsSetup
              onMission={setMission} onDeployment={setDeployment}
              onTerrain={setTerrain} onConfirmation={() => undefined} />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          disabled={!catalogue} onClick={send}>
          Save what was played
        </Button>
      </DialogActions>
    </Dialog>
  );
}
