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
  round, tables, played, roster, busy, published, drawPublic, teams,
  onPublish, onDraw, onPaste, onAdd, onAddFixture, onScores,
}: {
  round: number;
  tables: number;
  played: number;
  roster: number;
  /**
   * How many teams are entered, or null at an ordinary event. A team draw is
   * made from the teams rather than from the roster, and pasting or adding a
   * single table into one would make a table belonging to no fixture.
   */
  teams: number | null;
  busy: boolean;
  /** Null when the round does not exist yet, so there is nothing to publish. */
  published: boolean | null;
  /** Who "on show" means, which the block at the foot of the page sets. */
  drawPublic: boolean;
  onPublish: (on: boolean) => void;
  onDraw: () => void;
  onPaste: () => void;
  onAdd: () => void;
  /** Only at a team event, where a round is built out of fixtures. */
  onAddFixture: () => void;
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
            : teams === null
              ? `${roster} ${roster === 1 ? "PLAYER" : "PLAYERS"} TO PAIR`
              : `${teams} ${teams === 1 ? "TEAM" : "TEAMS"} TO PAIR`}
        </Typography>

        {/* It read "Members can see this draw" and the gate has never been
            membership: a ticket is what opens it. The client read the label,
            asked for non-members to be let in, and they were already in. The
            switch says what it does now and the line under it says who that
            reaches, which is the setting at the foot of the page. */}
        {published === null ? null : (
          <FormControlLabel
            sx={{ alignItems: "flex-start", mr: 0 }}
            control={<Switch checked={published} disabled={busy}
              sx={{ mt: 0.25 }}
              onChange={(event) => onPublish(event.target.checked)} />}
            label={
              <Stack spacing={0}>
                <Typography variant="body2">Put this round on show</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: tokens.inkMuted }}>
                  {published
                    ? (drawPublic ? "Anybody can see it" : "Everybody coming can see it")
                    : "Only your team can see it"}
                </Typography>
              </Stack>
            }
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
        {/* Both make a table on its own, which at a team event is a table
            belonging to no fixture: it would never be scored into a team
            total and would sit on the draw looking exactly like one that
            would. The draw button is the only way in. */}
        {/* A team event builds a round out of fixtures, so that is the
            control it gets. 0168 showed nothing here at all, on the reasoning
            that a loose table belongs to no fixture: true of a table, and it
            left a club whose format the shuffle does not understand with no
            way to build a round by hand. The tables go inside a fixture,
            which is where that control now is. */}
        {teams !== null ? (
          <Button variant="outlined" size="small" startIcon={<AddIcon />}
            disabled={busy || teams < 2} onClick={onAddFixture}>
            Add a fixture
          </Button>
        ) : null}

        {teams === null ? (
          <>
            <Button variant="outlined" size="small" startIcon={<ContentPasteIcon />}
              disabled={busy} onClick={onPaste}>
              Paste a draw
            </Button>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} disabled={busy}
              onClick={onAdd}>
              Add a table
            </Button>
          </>
        ) : null}
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
