"use client";

import { startTransition, useActionState, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useActionToast } from "@/components/ui/Toaster";
import { competitionAction, type CompetitionState }
  from "@/app/clubs/[slug]/competitions/actions";
import { playedFrom } from "@/utils/competition-meta";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CompetitionStanding } from "@/types/competition";

type Row = {
  key: string;
  memberName: string;
  profileId: string | null;
  wins: number; draws: number; losses: number; points: number;
  faction: string;
  notes: string;
};

/**
 * The league table, edited as a whole.
 *
 * Rank and played are not fields. Rank is a position in the sorted table and
 * played is wins plus draws plus losses, so asking a club to keep either in its
 * head is asking it to make them wrong. Both are computed on save.
 */
export default function StandingsEditor({
  competitionId, slug, faction, standings, roster,
}: {
  competitionId: number;
  slug: string;
  faction: Faction;
  standings: CompetitionStanding[];
  /** Members who hold an account here, so a row can be linked to a profile. */
  roster: { id: string; name: string }[];
}) {
  const [state, submit, busy] = useActionState<CompetitionState, FormData>(
    competitionAction, {});
  useActionToast(state);

  // A new row opens; existing ones stay shut. Somebody adding a player wants
  // the fields, somebody scanning a table of twenty does not.
  const [openRow, setOpenRow] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>(() => standings.map((s, i) => ({
    key: `existing-${i}`,
    memberName: s.memberName,
    profileId: s.profileId,
    wins: s.wins, draws: s.draws, losses: s.losses, points: s.points,
    faction: s.faction,
    notes: s.notes,
  })));

  const patch = (key: string, change: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));

  const save = () => {
    const data = new FormData();
    data.set("intent", "standings");
    data.set("slug", slug);
    data.set("competitionId", String(competitionId));
    data.set("rows", JSON.stringify(rows.map((r) => ({
      memberName: r.memberName, profileId: r.profileId,
      wins: r.wins, draws: r.draws, losses: r.losses, points: r.points,
      notes: r.notes, faction: r.faction,
    }))));
    startTransition(() => submit(data));
  };

  const number = (value: string) => Math.max(0, Math.floor(Number(value) || 0));

  return (
    <Stack spacing={2}>
      {rows.length ? (
        <Stack spacing={1.25}>
          {rows.map((row, index) => (
            <Accordion key={row.key} disableGutters
              expanded={openRow === row.key}
              onChange={(_e, open) => setOpenRow(open ? row.key : null)}
              sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                    backgroundColor: tokens.paper, boxShadow: "none",
                    "&::before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1.5}
                  sx={{ alignItems: "baseline", flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", fontWeight: 700,
                                    color: tokens.inkMuted, minWidth: 22 }}>
                    {index + 1}
                  </Typography>
                  <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>
                    {row.memberName || "New player"}
                  </Typography>
                  <Typography noWrap sx={{ fontFamily: mono, fontSize: "0.68rem",
                                           color: tokens.inkMuted, ml: "auto" }}>
                    {[row.faction, `${row.wins}-${row.draws}-${row.losses}`,
                      `${row.points} PTS`].filter(Boolean).join(" · ").toUpperCase()}
                  </Typography>
                </Stack>
              </AccordionSummary>

              <AccordionDetails>
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
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}>
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

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField size="small" label="Army" fullWidth value={row.faction}
                  onChange={(e) => patch(row.key, { faction: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: 120 } }} />
                <TextField size="small" label="Note" fullWidth value={row.notes}
                  onChange={(e) => patch(row.key, { notes: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: 300 } }} />
              </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nobody in the table yet. Add the players and the standings appear on the
          club page.
        </Typography>
      )}

      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap", pt: 0.5 }}>
        <Button variant="outlined" startIcon={<AddIcon />} disabled={busy}
          onClick={() => {
            const key = `new-${Date.now()}`;
            setRows((prev) => [...prev, {
              key, memberName: "", profileId: null,
              wins: 0, draws: 0, losses: 0, points: 0, faction: "", notes: "",
            }]);
            setOpenRow(key);
          }}
          sx={{ color: tokens.ink, borderColor: tokens.rule }}>
          Add a player
        </Button>

        <Button variant="contained" loading={busy} loadingPosition="start" onClick={save}
          sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}>
          Save the table
        </Button>

        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Ordered by points, then wins, then fewest losses.
        </Typography>
      </Stack>
    </Stack>
  );
}
