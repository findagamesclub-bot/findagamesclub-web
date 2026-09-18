"use client";

import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import { mono, tokens } from "@/lib/tokens";

/**
 * Where the round stands, and the four things to do about it.
 *
 * Above the tables rather than behind a menu: ten minutes between rounds is
 * the case this page is built for, and a draw that takes two taps to reach is
 * two taps in the wrong place.
 */
export default function RoundTools({
  round, tables, played, roster, busy, published,
  onPublish, onDraw, onPaste, onAdd, onScores,
}: {
  round: number;
  tables: number;
  played: number;
  roster: number;
  busy: boolean;
  /** Null when the round does not exist yet, so there is nothing to publish. */
  published: boolean | null;
  onPublish: (on: boolean) => void;
  onDraw: () => void;
  onPaste: () => void;
  onAdd: () => void;
  onScores: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {tables
            ? `${tables} ${tables === 1 ? "TABLE" : "TABLES"} · ${played} PLAYED`
            : `${roster} ${roster === 1 ? "PLAYER" : "PLAYERS"} TO PAIR`}
        </Typography>

        {published === null ? null : (
          <FormControlLabel
            control={<Switch checked={published} disabled={busy}
              onChange={(event) => onPublish(event.target.checked)} />}
            label={<Typography variant="body2">Members can see this draw</Typography>}
          />
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
        <Button variant="outlined" size="small" startIcon={<ShuffleIcon />} disabled={busy}
          onClick={onDraw}>
          {/* The page is called The draw, so the button makes one. Two earlier
              labels said where the names came from ("Draw from the roster") or
              used a verb that could mean several things ("Pair everybody up"),
              and the client had to ask what each meant. */}
          {tables ? "Make it again" : "Make the draw"}
        </Button>
        <Button variant="outlined" size="small" startIcon={<ContentPasteIcon />} disabled={busy}
          onClick={onPaste}>
          Paste a draw
        </Button>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} disabled={busy}
          onClick={onAdd}>
          Add a table
        </Button>
        {tables ? (
          <Button variant="contained" size="small" startIcon={<ScoreboardIcon />} disabled={busy}
            onClick={onScores} aria-label={`Enter round ${round} scores`}>
            Enter scores
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
