"use client";

import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  CONFIRMATIONS, DEPLOYMENTS, MISSION_SUGGESTIONS, TERRAIN_SUGGESTIONS,
} from "@/utils/result-meta";
import { tokens } from "@/lib/tokens";

/**
 * How the game was set up, alongside the score.
 *
 * Legacy calls this Match context and records four things (club_store.py:6761).
 * Missions and terrain are free text with suggestions, because clubs invent
 * their own and a closed list would be wrong within a season; deployment is a
 * fixed six and the column enforces it.
 *
 * All of it is optional. Somebody who only wants to put a score in should not
 * have to fill in a form about it, which is why this sits under a quiet
 * heading rather than above the scores.
 */
export default function MatchContextFields({
  mission, deployment, terrain, confirmation, canManageClub,
  onMission, onDeployment, onTerrain, onConfirmation,
}: {
  mission: string;
  deployment: string;
  terrain: string;
  confirmation: string;
  /** Only the club may set the state, which is legacy's rule. */
  canManageClub: boolean;
  onMission: (value: string) => void;
  onDeployment: (value: string) => void;
  onTerrain: (value: string) => void;
  onConfirmation: (value: string) => void;
}) {
  const chosen = CONFIRMATIONS.find((c) => c.value === confirmation);

  return (
    <Stack spacing={2} sx={{ pt: 0.5 }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                        letterSpacing: "0.12em", color: tokens.inkMuted, fontWeight: 700 }}>
        MATCH CONTEXT · OPTIONAL
      </Typography>

      <Autocomplete
        freeSolo
        options={MISSION_SUGGESTIONS}
        value={mission}
        onInputChange={(_event, value) => onMission(value)}
        renderInput={(params) => (
          <TextField {...params} label="Mission" size="small"
            helperText="Type your own, or pick one." />
        )}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label="Deployment" size="small" fullWidth
          value={deployment}
          onChange={(event) => onDeployment(event.target.value)}>
          <MenuItem value="">Not recorded</MenuItem>
          {DEPLOYMENTS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>

        <Box sx={{ width: "100%" }}>
          <Autocomplete
            freeSolo
            options={TERRAIN_SUGGESTIONS}
            value={terrain}
            onInputChange={(_event, value) => onTerrain(value)}
            renderInput={(params) => (
              <TextField {...params} label="Terrain" size="small" />
            )}
          />
        </Box>
      </Stack>

      {/* Shown to the club only. A player's save always puts the state back to
          Submitted, so an edit after an agreement cannot pass itself off as
          still agreed. */}
      {canManageClub ? (
        <TextField select label="Result state" size="small" fullWidth
          value={confirmation || "admin-confirmed"}
          onChange={(event) => onConfirmation(event.target.value)}
          helperText={chosen?.help ?? "Settled by the club. Only the club can change it now."}>
          {CONFIRMATIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>
      ) : null}
    </Stack>
  );
}
