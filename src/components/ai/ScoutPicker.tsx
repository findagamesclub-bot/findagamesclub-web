"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AiPanel from "./AiPanel";
import type { AiJob } from "@/types/ai";
import { tokens } from "@/lib/tokens";

export type Clubmate = { id: string; name: string };

/**
 * Who you are scouting.
 *
 * Clubmates only, because the evidence is what the club has recorded: their
 * confirmed games and what they brought to them. Somebody with no games at the
 * club can still be chosen and the pack will say it is built on nothing, which
 * is more useful than hiding them and leaving the reader wondering why.
 */
export default function ScoutPicker({
  slug, listId, clubmates, reason, usage, initial,
}: {
  slug: string;
  listId: number;
  clubmates: Clubmate[];
  reason: string | null;
  usage: { message: string; limited: boolean; remaining: number | null };
  initial: AiJob | null;
}) {
  const [who, setWho] = useState<Clubmate | null>(null);

  return (
    <Stack spacing={2.5}>
      <Autocomplete
        options={clubmates}
        value={who}
        getOptionLabel={(one) => one.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        onChange={(_, next) => setWho(next)}
        sx={{ maxWidth: 520 }}
        renderInput={(params) => (
          <TextField {...params} label="Who are you scouting"
            helperText="Built from their confirmed games at this club and your record against them." />
        )} />

      {who ? (
        <AiPanel feature="scouting" slug={slug} listId={listId}
          opponentProfileId={who.id}
          reason={reason} usage={usage} initial={initial} />
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Pick a clubmate and the pack is about them.
        </Typography>
      )}
    </Stack>
  );
}
