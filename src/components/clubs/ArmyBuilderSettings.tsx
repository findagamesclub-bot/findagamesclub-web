"use client";

import { useActionState, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { builderAction, type BuilderState }
  from "@/app/clubs/[slug]/(console)/manage/army-builder/actions";
import type { EditionRow } from "@/services/armyCatalogue.service";
import { mono, tokens } from "@/lib/tokens";

/**
 * The club's own switch.
 *
 * A published catalogue has to exist before this can be turned on: without one
 * there is nothing for a result to be validated against, and a switch that can
 * be flipped into doing nothing is worse than one that explains itself.
 */
export default function ArmyBuilderSettings({
  slug, enabled, editionId, editions,
}: {
  slug: string;
  enabled: boolean;
  editionId: string | null;
  editions: EditionRow[];
}) {
  const [state, act, busy] = useActionState<BuilderState, FormData>(builderAction, {});
  useActionToast(state);
  const [, start] = useTransition();

  const [on, setOn] = useState(enabled);
  const [edition, setEdition] = useState(editionId ?? editions[0]?.id ?? "");

  if (!editions.length) {
    return (
      <EmptyState
        title="No published catalogue yet"
        description="A site admin has to publish an army catalogue before a club can record what people played. Until then, results carry the score and the game and nothing else."
      />
    );
  }

  return (
    <Stack component="form" spacing={3}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData();
        data.set("slug", slug);
        data.set("enabled", String(on));
        data.set("edition", edition);
        // Dispatched inside a transition, or the pending flag never flips and
        // the button sits there looking dead.
        start(() => act(data));
      }}>
      <Stack spacing={1.5}
        sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
              backgroundColor: tokens.paper }}>
        <FormControlLabel
          control={<Switch checked={on} onChange={(e) => setOn(e.target.checked)} />}
          label="Record what people played"
        />
        <Typography sx={{ fontSize: "0.9rem", color: tokens.inkMuted }}>
          {on
            ? "Members see faction, detachment and disposition on a result, and your club page gets its faction analytics."
            : "Results carry the score and the game, exactly as they do now."}
        </Typography>
      </Stack>

      <TextField select label="Catalogue" value={edition} disabled={!on}
        onChange={(event) => setEdition(event.target.value)}
        helperText="Every result records which version it was played under, so publishing a new one never rewrites an old game.">
        {editions.map((one) => (
          <MenuItem key={one.id} value={one.id}>
            {one.label}
            <Box component="span"
              sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted, ml: 1 }}>
              {one.catalogue_version}
            </Box>
          </MenuItem>
        ))}
      </TextField>

      <Stack direction="row">
        <SubmitButton label="Save" pendingLabel="Saving the setting"
          variant="contained" pending={busy} />
      </Stack>
    </Stack>
  );
}
