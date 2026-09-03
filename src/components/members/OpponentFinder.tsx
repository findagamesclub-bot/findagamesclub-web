"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import AddIcon from "@mui/icons-material/Add";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { OpponentFinder as Finder } from "@/services/games.service";
import type { Suggestion } from "@/utils/opponent-finder";

function Card({
  suggestion, faction, best,
}: {
  suggestion: Suggestion;
  faction: Faction;
  best: boolean;
}) {
  return (
    <Stack spacing={1.25}
      sx={{ p: 2.25, borderRadius: 2,
            border: `1px solid ${best ? faction.base : tokens.rule}`,
            backgroundColor: best ? faction.soft : tokens.paper }}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 0 }}>
          {best ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: faction.deep }}>
              BEST MATCH
            </Typography>
          ) : null}
          <NextLink href={`/members/${suggestion.id}`}
            style={{ textDecoration: "none", color: "inherit" }}>
            <Typography sx={{ fontFamily: display, fontSize: "1.05rem", fontWeight: 700,
                              "&:hover": { color: faction.base } }}>
              {suggestion.name}
            </Typography>
          </NextLink>
        </Box>

        {/* Only when they have actually played. A 0.0% badge on somebody who
            has never recorded a game reads as a bad player, not a new one. */}
        {suggestion.winRate > 0 || suggestion.playedBefore > 0 ? (
          <Chip size="small" label={`${suggestion.winRate.toFixed(1)}% win rate`}
            sx={{ flexShrink: 0, bgcolor: tokens.paper, fontFamily: mono,
                  fontSize: "0.68rem", fontWeight: 700 }} />
        ) : null}
      </Stack>

      {suggestion.sharedGames.length ? (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {suggestion.sharedGames.slice(0, 3).map((game) => (
            <Chip key={game} size="small" label={game}
              sx={{ bgcolor: tokens.paper, fontWeight: 600, fontSize: "0.7rem",
                    textTransform: "capitalize" }} />
          ))}
        </Stack>
      ) : null}

      {/* Why, in legacy's own words. A recommendation nobody can argue with is
          a recommendation nobody trusts. */}
      <Stack spacing={0.25}>
        {suggestion.reasons.map((reason) => (
          <Typography key={reason} variant="body2" sx={{ color: tokens.inkMuted }}>
            {reason}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * Who to play next at this club.
 *
 * Scored on history, shared games, shared play style and how close the two
 * records are, using legacy's weights. The reasons are shown because the
 * ranking is a judgement, and one nobody can see the working of is one nobody
 * acts on.
 */
export default function OpponentFinder({
  finder, faction,
}: {
  finder: Finder;
  faction: Faction;
}) {
  const [expanded, setExpanded] = useState(false);
  const [best, ...rest] = finder.suggestions;

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 }, mb: 4, borderRadius: 2,
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted }}>
            OPPONENT FINDER
          </Typography>
          <Typography sx={{ fontFamily: display, fontSize: "1.15rem", fontWeight: 700 }}>
            {best ? "Recommended opponents for you" : "Recommended opponents"}
          </Typography>
        </Box>

        {finder.myGames > 0 ? (
          <Chip size="small" label={`My win rate: ${finder.myWinRate.toFixed(1)}%`}
            sx={{ flexShrink: 0, bgcolor: tokens.paper, fontFamily: mono,
                  fontSize: "0.68rem", fontWeight: 700 }} />
        ) : null}
      </Stack>

      {best ? (
        <Stack spacing={1.5}>
          <Card suggestion={best} faction={faction} best />

          {rest.length && !expanded ? (
            <Button variant="text" startIcon={<AddIcon />}
              onClick={() => setExpanded(true)}
              sx={{ alignSelf: "flex-start", color: tokens.brand }}>
              {`Show ${rest.length} more recommendation${rest.length === 1 ? "" : "s"}`}
            </Button>
          ) : null}

          {expanded ? (
            <Box sx={{ display: "grid", gap: 1.5,
                       gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
              {rest.map((suggestion) => (
                <Card key={suggestion.id} suggestion={suggestion} faction={faction}
                  best={false} />
              ))}
            </Box>
          ) : null}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Add the games you play to your profile, and record a few results, to
          get suggestions here.
        </Typography>
      )}
    </Box>
  );
}
