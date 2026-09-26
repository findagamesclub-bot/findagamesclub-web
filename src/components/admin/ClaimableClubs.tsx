"use client";

import { useActionState, useState, useTransition } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import Panel from "@/components/members/Panel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { claimableAction, type ClaimableState } from "@/app/admin/claims/actions";
import { mono, tokens } from "@/lib/tokens";

type Club = { id: number; name: string; city: string; claimable: boolean };

/**
 * Which listings somebody can put their hand up for.
 *
 * The directory was imported, so most of it is real clubs that none of those
 * clubs can touch, and a claim can only start where an admin has opened the
 * door. Without this the whole claim flow needs a SQL console to begin.
 *
 * Only clubs with nobody on them are offered: a club with an owner is
 * somebody's, and a change of hands there is a transfer, not a claim. The
 * database refuses it either way.
 */
export default function ClaimableClubs({ open, closed }: { open: Club[]; closed: Club[] }) {
  const [state, act, working] =
    useActionState<ClaimableState, FormData>(claimableAction, {});
  useActionToast(state);

  const [, start] = useTransition();
  const [picked, setPicked] = useState<Club | null>(null);
  const [closing, setClosing] = useState<Club | null>(null);

  const send = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    start(() => act(data));
  };

  return (
    <Stack spacing={2.5}>
      <Panel title="A club already in your directory" icon={HowToRegIcon}>
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            send({ intent: "open", club: String(picked?.id ?? 0) });
          }}>
          <Stack spacing={2}>
            <Autocomplete
              options={closed}
              value={picked}
              onChange={(_, next) => setPicked(next)}
              getOptionLabel={(option) => `${option.name}, ${option.city}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label="Club"
                  helperText="Pick one and it opens to claims. Only clubs with nobody running them: a club that has an owner changes hands by transfer, not by claim." />
              )}
            />
            <SubmitButton label="Open it to claims" pendingLabel="Opening it to claims"
              variant="contained" blocked={!picked} pending={working}
              sx={{ alignSelf: "flex-start" }} />
          </Stack>
        </Box>
      </Panel>

      <Panel title="Open to claims now">
        {open.length === 0 ? (
          <EmptyState
            title="No club is open to claims"
            description="Open one you already list, or create one you do not. Until then the claim button never appears on any club page."
          />
        ) : (
          <Stack spacing={1.5}>
            {open.map((club) => (
              <Stack key={club.id} direction={{ xs: "column", sm: "row" }} spacing={1.5}
                sx={{ alignItems: { sm: "center" }, justifyContent: "space-between",
                      p: 2, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                      backgroundColor: tokens.paper }}>
                <Stack spacing={0.3} sx={{ minWidth: 0 }}>
                  <Typography variant="h4" sx={{ fontSize: "1rem" }}>{club.name}</Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                    color: tokens.inkMuted }}>
                    {club.city}
                  </Typography>
                </Stack>
                <Button variant="outlined" onClick={() => setClosing(club)}
                  sx={{ alignSelf: "flex-start" }}>
                  Close it
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </Panel>

      <Panel title="A club that is not in your directory" icon={AddBusinessIcon}>
        <Box component="form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            send({
              intent: "create",
              name: String(data.get("name") ?? ""),
              city: String(data.get("city") ?? ""),
            });
            event.currentTarget.reset();
          }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField name="name" label="Club name" fullWidth required />
              <TextField name="city" label="Town or city" fullWidth required />
            </Stack>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              This creates the club. A bare listing with nothing but a name and a
              town, live in the directory and open to claims from the moment it
              is saved. Whoever claims it fills in the rest, which is the point:
              a club writes its own page better than we do.
            </Typography>
            <SubmitButton label="Add the listing" pendingLabel="Adding the listing"
              variant="contained" pending={working} sx={{ alignSelf: "flex-start" }} />
          </Stack>
        </Box>
      </Panel>

      <ConfirmDialog
        open={closing !== null}
        title={`Close ${closing?.name ?? "this listing"} to claims?`}
        body="The claim button goes from the club page. Anything already claimed stays in the queue for you to answer."
        confirmLabel="Close it"
        busy={working}
        onConfirm={() => send({ intent: "close", club: String(closing?.id ?? 0) })}
        onClose={() => setClosing(null)}
      />
    </Stack>
  );
}
