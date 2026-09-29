"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AiPanel from "./AiPanel";
import type { AiFeature } from "@/utils/ai-access";
import type { AiJob } from "@/types/ai";
import { tokens } from "@/lib/tokens";

export type Faction = { id: string; label: string };

/**
 * Who is on the other side.
 *
 * The faction is the question, not the list: a matchup against Aeldari is a
 * different analysis from one against Death Guard, and two Aeldari lists are
 * closer to each other than either is to a third faction. It also keeps the
 * cache key honest, since the signature is the list plus the faction.
 *
 * Nothing runs until one is chosen, because a matchup against nobody is a
 * question with no answer and it would still cost a run.
 */
export default function OpponentPicker({
  feature, slug, listId, factions, reason, usage, initial,
}: {
  feature: AiFeature;
  slug: string;
  listId: number;
  factions: Faction[];
  reason: string | null;
  usage: { message: string; limited: boolean; remaining: number | null };
  initial: AiJob | null;
}) {
  const [opponent, setOpponent] = useState<Faction | null>(null);

  return (
    <Stack spacing={2.5}>
      <Autocomplete
        options={factions}
        value={opponent}
        getOptionLabel={(one) => one.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, next) => setOpponent(next)}
        sx={{ maxWidth: 520 }}
        renderInput={(params) => (
          <TextField {...params} label="Who are you playing"
            helperText="The faction is the question. Pick it and the analysis is about that match-up." />
        )} />

      {opponent ? (
        <AiPanel feature={feature} slug={slug} listId={listId}
          opponent={{ factionId: opponent.id, factionLabel: opponent.label }}
          reason={reason} usage={usage} initial={initial} />
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Choose a faction above and the analysis is about that game.
        </Typography>
      )}
    </Stack>
  );
}
