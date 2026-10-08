"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArmyPicker, { type ArmyNaming } from "@/components/results/ArmyPicker";
import ArmyListPicker from "@/components/results/ArmyListPicker";
import type { Catalogue } from "@/utils/army-catalogue";
import type { Builder, MemberList } from "@/services/resultArmies.service";
import type { EventPlacing } from "@/types/event";
import { tokens } from "@/lib/tokens";

/**
 * What the winner took, in whatever state the catalogue is in.
 *
 * Its own file because the dialog passed the 200-line rule when the cascade
 * arrived. A club with the builder off keeps the two plain boxes it has always
 * had, and so does one whose catalogue will not load: a placing is worth
 * recording even when the faction list is not there to check it against.
 *
 * The saved list leads, above the faction it fills in. The client asked for it
 * in those words, and the old caption under these boxes said the list "arrives
 * with the Army Builder", which shipped two stages ago and never came back for
 * this screen.
 */
export default function PlacingArmyFields({
  builder, catalogue, loading, failed, placing, army, onChange,
  lists, listId, playerNamed, onList,
}: {
  builder: Builder | null;
  catalogue: Catalogue | null;
  loading: boolean;
  failed: boolean;
  placing: EventPlacing | null;
  army: ArmyNaming;
  onChange: (next: ArmyNaming) => void;
  /** Already narrowed to whoever is named on this placing. */
  lists: MemberList[];
  listId: number | null;
  playerNamed: boolean;
  onList: (list: MemberList | null) => void;
}) {
  // Its own Stack, so the caption's negative margin still sits against the
  // field above it rather than against the whole block.
  return (
    <Stack spacing={2.5}>
      {!builder || failed ? (
        <>
          <Box sx={{ display: "grid", gap: 2.5,
                     gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
            <TextField name="faction" label="Faction"
              defaultValue={placing?.army?.factionLabel ?? ""}
              slotProps={{ htmlInput: { maxLength: 80 } }} />
            <TextField name="detachment" label="Detachment"
              defaultValue={placing?.army?.detachment ?? ""}
              slotProps={{ htmlInput: { maxLength: 80 } }} />
          </Box>
          <Typography variant="caption" sx={{ color: tokens.inkMuted, mt: -1.5 }}>
            {failed
              ? "The army catalogue would not load, so these are plain boxes."
              : "Both optional. The army list itself arrives with the Army Builder."}
          </Typography>
        </>
      ) : loading || !catalogue ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Loading this club&apos;s army catalogue
        </Typography>
      ) : (
        <>
          {/* Controlled, so the values reach the action as fields. */}
          <input type="hidden" name="faction" value={army.factionLabel} />
          <input type="hidden" name="detachment" value={army.detachment} />
          <input type="hidden" name="disposition" value={army.disposition} />
          <input type="hidden" name="listId" value={listId === null ? "" : listId} />

          {/* Nothing: the Player field directly above carries "their army
              lists appear below" in its own helper text, and a second,
              larger paragraph saying the same thing was the first thing the
              eye landed on in this dialog. */}
          <ArmyListPicker lists={lists} value={listId} playerNamed={playerNamed}
            unnamedNote="" onChange={onList} />

          <ArmyPicker catalogue={catalogue} value={army} onChange={onChange} />
          <Typography variant="caption" sx={{ color: tokens.inkMuted, mt: -1.5 }}>
            All optional. Naming a list fills the three boxes above in from it.
          </Typography>
        </>
      )}
    </Stack>
  );
}
