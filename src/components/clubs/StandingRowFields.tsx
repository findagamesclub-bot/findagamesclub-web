"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ArmyPicker from "@/components/results/ArmyPicker";
import ArmyListPicker from "@/components/results/ArmyListPicker";
import { playedFrom } from "@/utils/competition-meta";
import type { Catalogue } from "@/utils/army-catalogue";
import type { Builder, MemberList } from "@/services/resultArmies.service";
import { display, mono, tokens } from "@/lib/tokens";
import type { StandingRow } from "./StandingsEditor";

/**
 * One player's row, open.
 *
 * Its own file because the editor passed the 200-line rule when the army
 * cascade arrived, and because a row is a thing: fields, a remove, and the
 * army it took.
 */
export default function StandingRowFields({
  row, roster, patch, onRemove, builder, catalogue, loading, failed, lists,
}: {
  row: StandingRow;
  roster: { id: string; name: string }[];
  /** Every list built at this club. Narrowed here to the player on this row. */
  lists: MemberList[];
  patch: (key: string, change: Partial<StandingRow>) => void;
  onRemove: () => void;
  /** Null at a club that does not record armies, which keeps the plain box. */
  builder: Builder | null;
  catalogue: Catalogue | null;
  loading: boolean;
  failed: boolean;
}) {
  const number = (value: string) => Math.max(0, Math.floor(Number(value) || 0));

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
        <TextField
          select size="small" label="Player" fullWidth
          value={row.profileId ?? "guest"}
          onChange={(event) => {
            const value = event.target.value;
            const member = roster.find((m) => m.id === value);
            // Picking a member fills the name too, so the table matches
            // the profile it links to rather than a typed variant of it.
            // The list goes with the player. It belongs to an account, so
            // leaving it behind would post a list the new name does not own
            // and the trigger would refuse the whole table over a field
            // nobody could see. Same reset `usePlacingArmy` makes when the
            // name on a placing moves.
            patch(row.key, member
              ? { profileId: member.id, memberName: member.name, listId: null }
              : { profileId: null, listId: null });
          }}
        >
          <MenuItem value="guest">Not a member here</MenuItem>
          {roster.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
        </TextField>

        <IconButton size="small" aria-label={`Remove ${row.memberName || "this row"}`}
          onClick={() => onRemove()}>
          <DeleteOutlinedIcon sx={{ fontSize: 19, color: tokens.inkMuted }} />
        </IconButton>
      </Stack>

      {/* Only for a guest. Picking a member already fills the name in from
          their account, so the box underneath was a second place to write a
          name the row was not going to use: type "J. Matthews" into it over a
          linked Joe Matthews and the table says one thing while the profile it
          counts on says another. The client asked for it to go, and the seed
          has a row proving why — it reads "Joe Matthews" over Gulnabi Afridi's
          account, which is what a wrong badge looks like from the other end. */}
      {row.profileId ? (
        <Typography sx={{ fontFamily: display, fontSize: "0.75rem",
                          lineHeight: 1.6, color: tokens.inkMuted }}>
          {`Named from their account, so this counts on ${
            roster.find((m) => m.id === row.profileId)?.name ?? "their"
          }'s member page.`}
        </Typography>
      ) : (
        <TextField size="small" label="Name" fullWidth required
          value={row.memberName}
          onChange={(e) => patch(row.key, { memberName: e.target.value })}
          helperText="A guest. Counts in this table only."
          slotProps={{ htmlInput: { maxLength: 120 } }} />
      )}

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {([["wins", "W"], ["draws", "D"], ["losses", "L"], ["points", "Pts"]] as const)
          .map(([field, label]) => (
            <TextField key={field} size="small" label={label} type="number"
              sx={{ width: 84 }}
              value={row[field]}
              onChange={(e) => patch(row.key, { [field]: number(e.target.value) })}
              slotProps={{ htmlInput: { min: 0 } }} />
          ))}

        <Box sx={{ display: "grid", placeItems: "center", px: 1 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                            color: tokens.inkMuted }}>
            {`PLAYED ${playedFrom(row.wins, row.draws, row.losses)}`}
          </Typography>
        </Box>
      </Stack>

      {/* A club that does not record armies keeps the one box it has
          always had. One that does gets the same cascade as every
          other screen: faction, its detachments, that detachment's
          dispositions. */}
      {!builder || failed ? (
        <TextField size="small" label="Army" fullWidth value={row.faction}
          onChange={(e) => patch(row.key, { faction: e.target.value })}
          helperText={failed
            ? "The army catalogue would not load, so this is the plain box."
            : ""}
          slotProps={{ htmlInput: { maxLength: 120 } }} />
      ) : loading || !catalogue ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                          color: tokens.inkMuted }}>
          Loading this club&apos;s army catalogue
        </Typography>
      ) : (
        <ArmyPicker size="small" direction="row" catalogue={catalogue}
          value={{ factionId: row.faction, factionLabel: row.faction,
                   detachment: row.detachment, disposition: row.disposition }}
          onChange={(named) => patch(row.key, {
            // The label, not the id: this column has held a typed name
            // since 0024 and the standings table prints it.
            faction: named.factionLabel,
            detachment: named.detachment,
            disposition: named.disposition,
          })} />
      )}

      {/* Under the army, because a list is the long answer to the same
          question the cascade above asks in three words. Only at a club that
          records armies: with the builder off there is nothing to pick from.
          The picker says why it is empty rather than vanishing, and the Player
          box it points at is directly above. */}
      {builder && !failed ? (
        <ArmyListPicker
          lists={lists.filter((one) => one.profileId === row.profileId)}
          value={row.listId}
          playerNamed={Boolean(row.profileId)}
          unnamedNote="Pick a member above and the lists they have built at your club appear here."
          onChange={(list) => patch(row.key, list
            ? {
                listId: list.id,
                // A list already says all three, and typing them again is two
                // chances to disagree with it. Only where the club has not
                // said: 0194's trigger draws the same line.
                faction: row.faction || list.faction,
                detachment: row.detachment || list.detachment,
                disposition: row.detachment ? row.disposition : list.disposition,
              }
            : { listId: null })} />
      ) : null}

      <TextField size="small" label="Note" fullWidth value={row.notes}
        onChange={(e) => patch(row.key, { notes: e.target.value })}
        slotProps={{ htmlInput: { maxLength: 300 } }} />
    </Stack>
  );
}
