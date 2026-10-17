"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ArmyListDialog from "@/components/events/ArmyListDialog";
import MatchDetailDialog, { SetupNote, type MatchDetail }
  from "@/components/events/MatchDetailDialog";
import type { MatchSetup } from "@/utils/result-meta";
import type { Faction } from "@/lib/tokens";
import type { ResultArmy } from "@/types/event";

/**
 * One way into a game, wherever the game is listed.
 *
 * A table of an event draw, a league round and now both rivalry lists all ask
 * the same question and all answer it the same way: a quiet control, a match
 * dialog with both sides in it, and a swap to the full army list rather than a
 * second dialog stacked on the first. Written out four times it would have
 * been four behaviours by the time anybody noticed.
 *
 * The dialogs are rendered once per LIST, not once per row: a season has a
 * great many games and only one of them is ever open.
 */
export function useMatchDetail(faction: Faction) {
  const [game, setGame] = useState<MatchDetail | null>(null);
  const [list, setList] = useState<{ player: string; army: ResultArmy } | null>(null);

  // Swapped, never stacked, so there is one dialog open at a time and Close
  // still means close.
  const showList = (side: "one" | "two") => {
    const army = side === "one" ? game?.armyOne : game?.armyTwo;
    const player = side === "one" ? game?.playerOne : game?.playerTwo;
    if (!army?.list) return;
    setGame(null);
    setList({ player: player ?? "", army });
  };

  const dialogs = (
    <>
      <MatchDetailDialog match={game} onClose={() => setGame(null)}
        faction={faction} onShowList={showList} />
      <ArmyListDialog open={list !== null} onClose={() => setList(null)}
        player={list?.player ?? ""} army={list?.army ?? null} faction={faction} />
    </>
  );

  return { open: setGame, dialogs };
}

/**
 * The control itself, with whatever the club recorded about the table beside
 * it. Absent entirely where nothing was recorded: a row of controls that all
 * open "nothing here" is worse than no control.
 */
export function MatchDetailButton({
  onOpen, faction, setup = null, label = "The game",
}: {
  onOpen: () => void;
  faction: Faction;
  setup?: MatchSetup | null;
  label?: string;
}) {
  return (
    <Stack direction="row" spacing={1} useFlexGap
      sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
      <SetupNote setup={setup} />
      <Button size="small" variant="text"
        startIcon={<InfoOutlinedIcon sx={{ fontSize: 14 }} />}
        onClick={onOpen}
        sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: "0.72rem", color: faction.deep }}>
        {label}
      </Button>
    </Stack>
  );
}
