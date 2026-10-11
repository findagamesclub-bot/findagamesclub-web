"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import SubmitButton from "@/components/ui/SubmitButton";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { mono, tokens } from "@/lib/tokens";
import type { TeamFixture } from "@/types/eventTeams";

/**
 * The club's own score for one fixture.
 *
 * The client's words: "this might not just be a total of the players scores.
 * For example, adding up all players scores for round 1 could be 200 vs 190,
 * however this might be recorded in a different way, such as 5 points for team
 * A and 4 points for team B."
 *
 * So the players' total is shown here rather than hidden, because the number
 * somebody types is usually worked out from it. Clearing both boxes goes back
 * to the total, which is why the second button says that rather than "Cancel".
 */
export default function FixtureScoreDialog({
  fixture, open, busy, onClose, send,
}: {
  fixture: TeamFixture | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  send: (data: FormData) => void;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const [one, setOne] = useState("");
  const [two, setTwo] = useState("");

  // Seeded during render rather than in an effect, so opening on a second
  // fixture never paints the first one's figures for a frame.
  useWhenChanged([fixture?.id], () => {
    setOne(fixture?.pointsOne === null || fixture?.pointsOne === undefined
      ? "" : String(fixture.pointsOne));
    setTwo(fixture?.pointsTwo === null || fixture?.pointsTwo === undefined
      ? "" : String(fixture.pointsTwo));
  });

  if (!fixture) return null;

  const totalled = fixture.scoreOne !== null && fixture.scoreTwo !== null;
  const half = (one.trim() === "") !== (two.trim() === "");

  const submit = (clear: boolean) => {
    const data = new FormData();
    data.set("intent", "score-fixture");
    data.set("fixtureId", String(fixture.id));
    data.set("teamPointsOne", clear ? "" : one);
    data.set("teamPointsTwo", clear ? "" : two);
    send(data);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="xs" fullScreen={small}>
      <DialogTitle sx={{ fontSize: "1.1rem" }}>
        Score this fixture
      </DialogTitle>

      <DialogContent>
        <Stack component="form" spacing={2.5} sx={{ pt: 1 }}
          onSubmit={(event) => { event.preventDefault(); submit(false); }}>
          <Typography sx={{ fontSize: "0.75rem", lineHeight: 1.5, color: tokens.inkMuted }}>
            For a format that does not decide a round by totalling the players.
            Leave it alone and the total below stands.
          </Typography>

          <Stack direction="row" spacing={2}>
            <TextField label={fixture.teamOneName || "Team one"} size="small" fullWidth
              value={one} autoFocus inputMode="numeric"
              onChange={(event) => setOne(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 4 } }} />
            <TextField label={fixture.teamTwoName || "Team two"} size="small" fullWidth
              value={two} inputMode="numeric"
              onChange={(event) => setTwo(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 4 } }} />
          </Stack>

          {half ? (
            <Typography variant="body2" sx={{ color: tokens.danger }}>
              Score both teams, or clear both to go back to the players&apos; total.
            </Typography>
          ) : null}

          {/* The figure the typed one is usually worked out from, so it does
              not have to be remembered from the row behind the dialog. */}
          <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                            letterSpacing: "0.08em", color: tokens.inkMuted }}>
            {totalled
              ? `PLAYERS SCORED ${fixture.scoreOne} - ${fixture.scoreTwo}`
              : "NO TABLES SCORED YET"}
          </Typography>

          <Stack direction="row" spacing={1.5}
            sx={{ justifyContent: "flex-end", flexWrap: "wrap", pb: 1 }}>
            <Button variant="text" onClick={onClose} disabled={busy}>Cancel</Button>
            {/* Named for what it does rather than "Clear": the fixture keeps a
                score either way, and this says which one it goes back to. */}
            <Button variant="text" disabled={busy}
              onClick={() => submit(true)}
              sx={{ color: tokens.inkMuted }}>
              Use the players&apos; total
            </Button>
            <SubmitButton label="Save the score" pendingLabel="Saving"
              variant="contained" pending={busy} blocked={half} />
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ display: "none" }} />
    </Dialog>
  );
}
