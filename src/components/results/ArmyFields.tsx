"use client";

import type { ReactNode } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArmyResultFields from "./ArmyResultFields";
import type { Catalogue } from "@/utils/army-catalogue";
import type { ResultArmy } from "@/utils/result-army";
import { mono, tokens } from "@/lib/tokens";

/**
 * The army half of a result dialog, in whatever state it is in.
 *
 * One component for every dialog that records a game, because four of them
 * ask the same question and four copies would have drifted the first time one
 * changed. What each caller decides is what `one` and `two` mean: the member's
 * dialog shows their own side first and the club's shows whoever booked.
 *
 * Four states, and only the first is the old behaviour: a club that does not
 * run the builder gets `fallback`, which is the two free-text boxes it has
 * always had.
 */
export default function ArmyFields({
  builder, catalogue, loading, failed,
  one, two, onOne, onTwo, oneTitle = "Your army", twoTitle, fallback,
}: {
  builder: { editionId: string; catalogueVersion: string } | null;
  catalogue: Catalogue | null;
  loading: boolean;
  failed: boolean;
  one: ResultArmy;
  two: ResultArmy;
  onOne: (next: ResultArmy) => void;
  onTwo: (next: ResultArmy) => void;
  oneTitle?: string;
  twoTitle: string;
  /** What a club with the builder off sees, unchanged. */
  fallback: ReactNode;
}) {
  if (!builder) return <>{fallback}</>;

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5}
        sx={{ px: 2, py: 1.75, borderRadius: 1.5, alignItems: "center",
              border: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        <CircularProgress size={16} sx={{ color: tokens.brass }} />
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
          Loading this club&apos;s army catalogue
        </Typography>
      </Stack>
    );
  }

  // No free-text boxes to fall back on here, deliberately. Writing the typed
  // names into the label columns while an army recorded last week sits
  // untouched underneath would leave the two saying different things, and the
  // scores are what somebody opened this to save.
  if (failed || !catalogue) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        The army catalogue would not load, so the army fields are not here.
        The scores and everything else still save.
      </Typography>
    );
  }

  return (
    <>
      {/* Read by the action as one field. A form cannot post a shape, and two
          armies are a shape. */}
      <input type="hidden" name="armies"
        value={JSON.stringify({ one, two })} />
      <ArmyResultFields title={oneTitle} catalogue={catalogue}
        value={one} onChange={onOne} />
      <ArmyResultFields title={twoTitle} catalogue={catalogue}
        value={two} onChange={onTwo} />
    </>
  );
}
