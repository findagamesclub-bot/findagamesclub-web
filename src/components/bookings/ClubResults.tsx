"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import ClubResultDialog from "./ClubResultDialog";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { confirmationLabel, deploymentLabel } from "@/utils/result-meta";
import { nightLabel } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ClubResult } from "@/services/clubResults.service";

/**
 * Games played at this club, for the club.
 *
 * The account pages only show a member the games they were in, which left a
 * dispute between two other members with no way out: nobody could reach it to
 * settle it. This is the club's way in, and the only place a manager can rule
 * on a game they did not play.
 */
export default function ClubResults({
  results, slug, faction,
}: {
  results: ClubResult[];
  slug: string;
  faction: Faction;
}) {
  const [chosen, setChosen] = useState<ClubResult | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(results, 20, top);
  const disputed = results.filter((r) => r.confirmation === "disputed").length;
  const unscored = results.filter((r) => !r.recorded).length;

  if (!results.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing has been played here yet. Games appear the day after the table.
      </Typography>
    );
  }

  return (
    <>
      {/* Disputed first: it is stuck until the club rules on it. Unscored games
          are only waiting on somebody remembering, so they are a nudge rather
          than an alarm. */}
      {disputed ? (
        <Stack direction="row" spacing={1.5}
          sx={{ px: 2, py: 1.25, mb: 2, borderRadius: 2, alignItems: "center",
                backgroundColor: "#FBE9E7" }}>
          <LockIcon sx={{ fontSize: 17, color: "#8a2f22" }} />
          <Typography variant="body2" sx={{ color: "#8a2f22" }}>
            {disputed === 1
              ? "One result is disputed and waiting on you."
              : `${disputed} results are disputed and waiting on you.`}
          </Typography>
        </Stack>
      ) : null}

      {unscored ? (
        <Typography variant="body2" sx={{ color: "#5c4310", mb: 2, fontWeight: 600 }}>
          {unscored === 1
            ? "One game has no score yet. Either player can add it, or you can."
            : `${unscored} games have no score yet. Either player can add one, or you can.`}
        </Typography>
      ) : null}

      <Stack ref={top} spacing={1}>
        {paged.shown.map((result) => (
          <Stack key={result.id} direction={{ xs: "column", sm: "row" }} spacing={2}
            onClick={() => setChosen(result)}
            // A missing score is the thing to act on, so it is the thing that
            // gets the edge. A settled result is finished, not urgent, and was
            // wearing the highlight the unscored ones needed.
            sx={{ px: 2, py: 1.5, borderRadius: 1.5, cursor: "pointer",
                  alignItems: { sm: "center" },
                  border: `1px solid ${
                    result.confirmation === "disputed" ? tokens.danger
                      : !result.recorded ? tokens.brass
                      : tokens.rule}`,
                  backgroundColor: tokens.paper,
                  "&:hover": { borderColor: faction.base } }}>
            <Box sx={{ minWidth: 92, flexShrink: 0 }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
                {nightLabel(result.date).toUpperCase()}
              </Typography>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {result.homeName} v {result.awayName}
              </Typography>
              <Typography variant="body2" noWrap sx={{ color: tokens.inkMuted }}>
                {[result.title, result.mission, deploymentLabel(result.deployment)]
                  .filter(Boolean).join(" · ")}
              </Typography>
            </Box>

            <Typography sx={{ fontFamily: mono, fontWeight: 700, flexShrink: 0,
                              fontSize: result.recorded ? "1.05rem" : "0.75rem",
                              color: result.recorded ? tokens.ink : "#5c4310" }}>
              {result.recorded
                ? `${result.homeScore} – ${result.awayScore}`
                : "ADD A SCORE"}
            </Typography>

            {result.recorded && result.confirmation !== "submitted" ? (
              <Chip size="small" label={confirmationLabel(result.confirmation)}
                icon={result.locked ? <LockIcon sx={{ fontSize: 13 }} /> : undefined}
                sx={{ fontSize: "0.66rem", height: 22, flexShrink: 0,
                      backgroundColor: result.confirmation === "disputed"
                        ? "#FBE9E7" : tokens.brassSoft,
                      color: result.confirmation === "disputed" ? "#8a2f22" : "#5c4310",
                      "& .MuiChip-icon": { color: "inherit" } }} />
            ) : null}
          </Stack>
        ))}
      </Stack>

      <Pager page={paged.page} total={paged.total} noun="games" size={20}
        onChange={paged.goTo} />

      <ClubResultDialog result={chosen} slug={slug} faction={faction}
        onClose={() => setChosen(null)} />
    </>
  );
}
