"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ArmyPicker from "@/components/results/ArmyPicker";
import { playedFrom } from "@/utils/competition-meta";
import type { Catalogue } from "@/utils/army-catalogue";
import type { Builder } from "@/services/resultArmies.service";
import { mono, tokens } from "@/lib/tokens";
import type { StandingRow } from "./StandingsEditor";

/**
 * One player's row, open.
 *
 * Its own file because the editor passed the 200-line rule when the army
 * cascade arrived, and because a row is a thing: fields, a remove, and the
 * army it took.
 */
export default function StandingRowFields({
  row, roster, patch, onRemove, builder, catalogue, loading, failed,
}: {
  row: StandingRow;
  roster: { id: string; name: string }[];
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
            patch(row.key, member
              ? { profileId: member.id, memberName: member.name }
              : { profileId: null });
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

      <TextField size="small" label="Name" fullWidth required
        value={row.memberName}
        onChange={(e) => patch(row.key, { memberName: e.target.value })}
        helperText={row.profileId
          ? "Linked to their profile, so this counts on their member page."
          : "A guest. Counts in this table only."}
        slotProps={{ htmlInput: { maxLength: 120 } }} />

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

      <TextField size="small" label="Note" fullWidth value={row.notes}
        onChange={(e) => patch(row.key, { notes: e.target.value })}
        slotProps={{ htmlInput: { maxLength: 300 } }} />
    </Stack>
  );
}
