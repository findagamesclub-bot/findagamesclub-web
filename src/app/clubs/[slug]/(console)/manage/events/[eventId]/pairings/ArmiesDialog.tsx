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
import ArmySide from "./ArmySide";
import { NO_ARMY, type ArmyNaming } from "@/components/results/ArmyPicker";
import { tokens } from "@/lib/tokens";
import type { Builder, MemberList } from "@/services/resultArmies.service";
import type { PairingArmy } from "@/services/eventPairingArmies.service";
import type { PairingMatch } from "@/types/eventEditor";

export type ArmyFields = Record<string, string>;

/**
 * What both players brought to one table.
 *
 * Its own dialog rather than more fields in the scores screen, which exists
 * because twenty tables and ten minutes is the case the draw is built for: a
 * faction cascade per side per table would make that ten minutes an hour.
 * Armies are typed whenever somebody gets round to it, which is the split
 * `save_pairing_armies` was written for in 0136 and never given a screen.
 *
 * Nothing here is required. A tournament that collects lists fills both sides
 * in; one that does not records the scores and leaves this alone, and the
 * event's analytics say how much of the field it has.
 */
export default function ArmiesDialog({
  match, builder, lists, recorded, saving, onClose, onSave,
}: {
  /** Null keeps this shut. */
  match: PairingMatch | null;
  builder: Builder | null;
  lists: MemberList[];
  /** What is already recorded, keyed `<matchId>:<side>`. */
  recorded: Record<string, PairingArmy>;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: ArmyFields) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("md"));
  const { catalogue, loading, failed } = useCatalogue(builder, match !== null);

  const [one, setOne] = useState<ArmyNaming>(NO_ARMY);
  const [two, setTwo] = useState<ArmyNaming>(NO_ARMY);
  const [listOne, setListOne] = useState<number | null>(null);
  const [listTwo, setListTwo] = useState<number | null>(null);

  // During render, so opening the next table never paints the last one's army.
  useWhenChanged([match?.id], () => {
    const held = (side: string): ArmyNaming => {
      const row = match ? recorded[`${match.id}:${side}`] : undefined;
      return row
        ? { factionId: row.factionId, factionLabel: row.factionLabel,
            detachment: row.detachment, disposition: row.disposition }
        : NO_ARMY;
    };
    setOne(held("one"));
    setTwo(held("two"));
    setListOne(match ? recorded[`${match.id}:one`]?.listId ?? null : null);
    setListTwo(match ? recorded[`${match.id}:two`]?.listId ?? null : null);
  });

  const pick = (
    set: (next: ArmyNaming) => void, setList: (id: number | null) => void,
  ) => (list: MemberList | null) => {
    setList(list?.id ?? null);
    // A list already says which army it is, so naming one answers the cascade
    // rather than asking for it twice.
    if (list) {
      set({ factionId: list.factionId, factionLabel: list.faction,
            detachment: list.detachment, disposition: list.disposition });
    }
  };

  const send = () => onSave({
    matchId: String(match?.id ?? 0),
    oneFactionId: one.factionId, oneFaction: one.factionLabel,
    oneDetachment: one.detachment, oneDisposition: one.disposition,
    oneList: listOne === null ? "" : String(listOne),
    twoFactionId: two.factionId, twoFaction: two.factionLabel,
    twoDetachment: two.detachment, twoDisposition: two.disposition,
    twoList: listTwo === null ? "" : String(listTwo),
  });

  const bye = !match?.playerTwo.trim();

  return (
    <Dialog open={match !== null} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        {`Table ${match?.tableLabel || ""}`.trim()}
      </DialogTitle>

      <DialogContent>
        {failed ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
            The army catalogue would not load, so there is nothing to pick from.
            The scores on this table are unaffected. Try again in a moment.
          </Typography>
        ) : loading || !catalogue ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 2 }}>
            Loading this club&apos;s army catalogue
          </Typography>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              All of it is optional, and it is what the event&apos;s analytics
              and the meta tracker are built from. Clearing a faction takes that
              side off both.
            </Typography>

            <Box sx={{ display: "grid", gap: 2, alignItems: "start",
                       gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                              md: "repeat(2, minmax(0, 1fr))" } }}>
              <ArmySide name={match?.playerOne ?? ""} player={match?.playerOneId ?? null}
                catalogue={catalogue} lists={lists} army={one} listId={listOne}
                onArmy={setOne} onList={pick(setOne, setListOne)} />

              {bye ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted, pt: 2 }}>
                  Nobody on the other side of this table.
                </Typography>
              ) : (
                <ArmySide name={match?.playerTwo ?? ""} player={match?.playerTwoId ?? null}
                  catalogue={catalogue} lists={lists} army={two} listId={listTwo}
                  onArmy={setTwo} onList={pick(setTwo, setListTwo)} />
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
        <Button variant="contained" loading={saving} loadingPosition="start"
          disabled={!catalogue}
          aria-label={saving ? "Saving the armies" : undefined}
          onClick={send}>
          Save armies
        </Button>
      </DialogActions>
    </Dialog>
  );
}
