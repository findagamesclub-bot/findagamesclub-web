"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import AddIcon from "@mui/icons-material/Add";
import CompetitionForm from "./CompetitionForm";
import EmptyState from "@/components/ui/EmptyState";
import { shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ManagedCompetition } from "@/services/competitions.service";

/** Every competition a club runs, whatever its state, with a way to add one. */
export default function CompetitionManager({
  clubId, slug, faction, competitions,
}: {
  clubId: number;
  slug: string;
  faction: Faction;
  competitions: ManagedCompetition[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <Stack spacing={2.5}>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}
        sx={{ alignSelf: "flex-start", bgcolor: faction.base,
              "&:hover": { bgcolor: faction.deep } }}>
        New competition
      </Button>

      {competitions.length ? (
        <Box sx={{ display: "grid", gap: 2, alignItems: "start",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
          {competitions.map((competition) => (
            <NextLink key={competition.id}
              href={`/clubs/${slug}/competitions/manage/${competition.id}`}
              style={{ textDecoration: "none" }}>
              <Stack sx={{ height: "100%", p: 2, borderRadius: 2,
                           border: `1px solid ${tokens.rule}`,
                           backgroundColor: tokens.paper,
                           transition: "border-color 140ms ease",
                           "&:hover": { borderColor: faction.base } }}>
                <Stack direction="row" spacing={1.5}
                  sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
                    {competition.title}
                  </Typography>
                  <Chip size="small" label={competition.statusLabel}
                    sx={{ fontSize: "0.62rem", height: 20, flexShrink: 0,
                          backgroundColor: competition.isCompleted
                            ? tokens.surface : tokens.brassSoft,
                          color: competition.isCompleted ? tokens.inkMuted : "#5c4310" }} />
                </Stack>

                <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                  letterSpacing: "0.06em", color: tokens.inkMuted, mt: 0.25 }}>
                  {[competition.typeLabel, competition.game, competition.season,
                    competition.startDate ? shortDate(competition.startDate) : null]
                    .filter(Boolean).join(" · ").toUpperCase()}
                </Typography>

                <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 1 }}>
                  {`${competition.standings.length} ${competition.standings.length === 1 ? "player" : "players"}`}
                  {` · ${competition.updates.length} ${competition.updates.length === 1 ? "round" : "rounds"}`}
                </Typography>
              </Stack>
            </NextLink>
          ))}
        </Box>
      ) : (
        <EmptyState
          title="No competitions yet"
          description="A league, ladder, campaign or season. Members see the table and the rounds on your club page."
        />
      )}

      <CompetitionForm clubId={clubId} slug={slug} faction={faction}
        competition={null} open={creating} onClose={() => setCreating(false)} />
    </Stack>
  );
}
