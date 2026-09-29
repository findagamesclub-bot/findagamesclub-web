"use client";

import { useActionState, useState } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MatchContextFields from "@/components/account/MatchContextFields";
import ArmyFields from "@/components/results/ArmyFields";
import { useCatalogue } from "@/hooks/useCatalogue";
import { EMPTY_ARMY, type ResultArmy } from "@/utils/result-army";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { clubResultAction, type ClubResultState }
  from "@/app/clubs/[slug]/results-actions";
import { confirmationLabel, toConfirmation } from "@/utils/result-meta";
import { nightLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ClubResult } from "@/services/clubResults.service";

/**
 * The club settling a game it did not play in.
 *
 * Both players are named rather than "you" and "them", because the person
 * reading this was not on the table. Everything else is the same form and the
 * same function as the player's version.
 */
export default function ClubResultDialog({
  result, slug, faction, onClose,
}: {
  result: ClubResult | null;
  slug: string;
  faction: Faction;
  onClose: () => void;
}) {
  // The same room as the member's dialog. It is the same form.
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [state, submit, busy] = useActionState<ClubResultState, FormData>(clubResultAction, {});
  useActionToast(state);

  const [mission, setMission] = useState("");
  const [deployment, setDeployment] = useState("");
  const [terrain, setTerrain] = useState("");
  const [confirmation, setConfirmation] = useState("admin-confirmed");
  const [home, setHome] = useState<ResultArmy>(EMPTY_ARMY);
  const [away, setAway] = useState<ResultArmy>(EMPTY_ARMY);
  const [seenId, setSeenId] = useState<number | null>(null);

  // Fetched once this is open and only for a club that records armies. One
  // dialog serves every game in the list, so the catalogue is fetched once for
  // the whole page rather than per game.
  const { catalogue, loading, failed } = useCatalogue(result?.builder, Boolean(result));

  // A different game opened, so the fields follow it. Derived during render:
  // an effect would paint one frame of the previous game's values.
  if (result && result.id !== seenId) {
    setSeenId(result.id);
    setMission(result.mission);
    setDeployment(result.deployment);
    setTerrain(result.terrain);
    setConfirmation(result.confirmation);
    // Started from what was recorded: saving an empty army deletes its row, so
    // opening a second game must not carry the first one's army into it.
    setHome(result.armies.one);
    setAway(result.armies.two);
  }

  // Close on success, stay open on a refusal so the typing survives it.
  useActionSuccess(state, onClose);

  return (
    <Dialog open={Boolean(result)} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="md" fullScreen={fullScreen}>
      {result ? (
        <>
          <DialogTitle sx={{ fontSize: "1.2rem" }}>
            {`${result.homeName} v ${result.awayName}`}
            <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
              {`${nightLabel(result.date).toUpperCase()} · ${result.title.toUpperCase()}`}
              {result.recorded ? ` · ${confirmationLabel(result.confirmation).toUpperCase()}` : ""}
            </Typography>
          </DialogTitle>

          <form action={submit}>
            <input type="hidden" name="bookingId" value={result.id} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="mission" value={mission} />
            <input type="hidden" name="deployment" value={deployment} />
            <input type="hidden" name="terrain" value={terrain} />
            <input type="hidden" name="confirmation" value={confirmation} />

            <DialogContent dividers>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={2}>
                  <TextField name="homeScore" label={`${result.homeName}'s score`}
                    type="number" fullWidth defaultValue={result.homeScore ?? ""} autoFocus
                    slotProps={{ htmlInput: { min: 0, step: "0.5" } }} />
                  <TextField name="awayScore" label={`${result.awayName}'s score`}
                    type="number" fullWidth defaultValue={result.awayScore ?? ""}
                    slotProps={{ htmlInput: { min: 0, step: "0.5" } }} />
                </Stack>

                <ArmyFields
                  builder={result.builder} catalogue={catalogue}
                  loading={loading} failed={failed}
                  one={home} two={away} onOne={setHome} onTwo={setAway}
                  oneTitle={`${result.homeName}'s army`}
                  twoTitle={`${result.awayName}'s army`}
                  fallback={
                    <Stack direction="row" spacing={2}>
                      <TextField name="homeArmy" label={`${result.homeName}'s army`}
                        fullWidth defaultValue={result.homeArmy} />
                      <TextField name="awayArmy" label={`${result.awayName}'s army`}
                        fullWidth defaultValue={result.awayArmy} />
                    </Stack>
                  }
                />

                <MatchContextFields
                  mission={mission} deployment={deployment} terrain={terrain}
                  confirmation={confirmation} canManageClub
                  onMission={setMission} onDeployment={setDeployment}
                  onTerrain={setTerrain}
                  onConfirmation={(value) => setConfirmation(toConfirmation(value))}
                />

                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  You are settling this as the club. Admin confirmed and Disputed both
                  lock it, so the players can no longer change it.
                </Typography>
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button type="button" variant="text" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" loading={busy} loadingPosition="start"
                sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}>
                Save result
              </Button>
            </DialogActions>
          </form>
        </>
      ) : null}
    </Dialog>
  );
}
