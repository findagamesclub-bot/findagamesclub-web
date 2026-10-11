"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CloseIcon from "@mui/icons-material/Close";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { mono, tokens } from "@/lib/tokens";
import type { EventTeam } from "@/types/eventTeams";
import type { Player } from "@/utils/pairings-draw";

type Row = { name: string; profileId: string };

/**
 * A team, and the order it plays in.
 *
 * The order is the point of this dialog, not an afterthought: the draw starts
 * by pairing first against first, so moving somebody up the list is the
 * captain deciding who takes
 * the hardest game. That is why the rows have arrows rather than being sorted
 * by name, and why the number beside each one is set in mono as a position and
 * not drawn as a bullet.
 *
 * Names take free text and offer the roster, the same as the draw's own table
 * dialog: somebody who paid at the door is in the team long before anybody has
 * typed them into a booking.
 */
export default function TeamDialog({
  open, team, roster, nextPosition, saving, onClose, onSave,
}: {
  open: boolean;
  /** Null for a new team. */
  team: EventTeam | null;
  roster: Player[];
  nextPosition: number;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: Record<string, string>, rows: Row[]) => void;
}) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));

  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useWhenChanged([open, team], () => {
    if (!open) return;
    setName(team?.name ?? "");
    setRows(team?.players.length
      ? team.players.map((player) => ({
          name: player.name, profileId: player.profileId ?? "" }))
      : [{ name: "", profileId: "" }]);
  });

  const idOf = (value: string) =>
    roster.find((p) => p.name.trim().toLowerCase() === value.trim().toLowerCase())
      ?.profileId ?? "";

  const names = roster.map((player) => player.name);
  const filled = rows.filter((row) => row.name.trim());

  // Somebody typed twice is a team that cannot be drawn, so it is
  // said here rather than refused after the save.
  const twice = filled
    .map((row) => row.name.trim().toLowerCase())
    .some((value, index, all) => all.indexOf(value) !== index);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const held = next[from]!;
    next[from] = next[to]!;
    next[to] = held;
    setRows(next);
  };

  // The account is resolved as they type rather than on save, so a name
  // changed to somebody else's does not keep the first person's profile.
  const set = (index: number, value: string) =>
    setRows(rows.map((row, i) =>
      (i === index ? { name: value, profileId: idOf(value) } : row)));

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose}
      fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {team ? `Edit ${team.name}` : "Add a team"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField label="Team name" fullWidth value={name} autoFocus
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 60 } }}
            helperText="What the draw calls them, so keep it short." />

          <Box>
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
              WHO PLAYS, IN ORDER
            </Typography>

            <Stack spacing={1.25}>
              {rows.map((row, index) => (
                <Stack key={index} direction="row" spacing={1}
                  sx={{ alignItems: "flex-start" }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", fontWeight: 700,
                                    color: tokens.inkMuted, width: 26, pt: 2 }}>
                    {index + 1}
                  </Typography>

                  <Autocomplete
                    freeSolo options={names} value={row.name} sx={{ flex: 1, minWidth: 0 }}
                    onInputChange={(_event, next) => set(index, next)}
                    renderInput={(params) => (
                      // Labelled Player, not "Player 2": the mono number to
                      // its left is already the playing order, and a field whose
                      // label repeats the thing beside it is two elements
                      // doing one job.
                      <TextField {...params} label="Player" fullWidth />
                    )}
                  />

                  {/* Spaced, because three of these sit together and one of
                      them takes a player off. `size="small"` is the house
                      icon button everywhere else, so the size stays and the
                      gap is what stops a mis-tap on a phone. */}
                  <Stack direction="row" spacing={0.5} sx={{ pt: 0.75 }}>
                    <IconButton size="small" aria-label={`Move player ${index + 1} up`}
                      disabled={index === 0} onClick={() => move(index, index - 1)}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label={`Move player ${index + 1} down`}
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, index + 1)}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label={`Take player ${index + 1} off`}
                      disabled={rows.length === 1}
                      onClick={() => setRows(rows.filter((_r, i) => i !== index))}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}
            </Stack>

            <Button startIcon={<AddIcon />} sx={{ mt: 1.5 }}
              onClick={() => setRows([...rows, { name: "", profileId: "" }])}>
              Add a player
            </Button>

            <Typography variant="caption" sx={{ display: "block", mt: 1,
                                                color: tokens.inkMuted }}>
              This is the order the draw starts from: the first here plays the
              other team&apos;s first, the second plays their second, and so on.
              Change any table afterwards on the draw. Every team should have
              the same number of players.
            </Typography>
          </Box>

          {twice ? (
            <Typography variant="body2" sx={{ color: tokens.danger }}>
              That is the same player twice.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" disabled={!name.trim() || !filled.length || twice}
          onClick={() => onSave({
            intent: "save-team",
            teamId: team ? String(team.id) : "",
            name,
            position: String(team?.position ?? nextPosition),
            // The captain is whoever is first and has an account, which
            // is who a club means by it. A field asking the same question
            // twice is a field that can disagree with the list above it.
            captainProfileId: idOf(filled[0]?.name ?? ""),
          }, rows.map((row) => ({ ...row, name: row.name.trim() })))}>
          {team ? "Save team" : "Add team"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
