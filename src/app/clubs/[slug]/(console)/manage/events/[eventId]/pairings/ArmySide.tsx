"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArmyPicker, { type ArmyNaming } from "@/components/results/ArmyPicker";
import ArmyListPicker from "@/components/results/ArmyListPicker";
import type { Catalogue } from "@/utils/army-catalogue";
import type { MemberList } from "@/services/resultArmies.service";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * One player's half of a table: their list, then what it is.
 *
 * The list leads because naming one answers the three boxes under it. A player
 * who paid at the door has a typed name and no account, so there is no list to
 * name: that half says so and says where to link them, rather than
 * disappearing and leaving a gap nobody can explain. Found by driving it, with
 * a sentence that pointed at a member picker this dialog does not have.
 */
export default function ArmySide({
  name, player, catalogue, lists, army, listId, onArmy, onList,
}: {
  /** "Side one" and "Side two" are not names a club recognises. */
  name: string;
  /** Null when the table carries a typed name with no account behind it. */
  player: string | null;
  catalogue: Catalogue;
  lists: MemberList[];
  army: ArmyNaming;
  listId: number | null;
  onArmy: (next: ArmyNaming) => void;
  onList: (list: MemberList | null) => void;
}) {
  return (
    <Stack spacing={2} sx={{ p: 2, borderRadius: 1.5, minWidth: 0,
                             border: `1px solid ${tokens.rule}`,
                             backgroundColor: tokens.paper }}>
      <Stack spacing={0.25}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          WHAT THEY PLAYED
        </Typography>
        <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1rem" }}
          noWrap>
          {name}
        </Typography>
      </Stack>

      <ArmyListPicker lists={lists.filter((list) => list.profileId === player)}
        value={listId} playerNamed={player !== null}
        unnamedNote={`${name || "This player"} is not linked to a member account, so there is no saved list to name. Close this and press Edit on the table to link them.`}
        onChange={onList} />

      <ArmyPicker catalogue={catalogue} value={army} onChange={onArmy} size="small" />
    </Stack>
  );
}
