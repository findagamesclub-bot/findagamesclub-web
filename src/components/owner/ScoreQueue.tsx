"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import ClubResultDialog from "@/components/bookings/ClubResultDialog";
import EmptyState from "@/components/ui/EmptyState";
import ResultGroup from "./ResultGroup";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";
import type { OwnerResult, ScoreQueue as Queue } from "@/services/ownerBookings.service";

/**
 * Every game at every club this person owns, sorted by what it needs.
 *
 * Ordered by urgency rather than by date, which is the whole reason for the
 * page: a dispute is stuck until the club rules on it, a missing score is
 * waiting on somebody remembering, and a settled result is only a record.
 */
export default function ScoreQueue({ queue }: { queue: Queue }) {
  const [chosen, setChosen] = useState<OwnerResult | null>(null);

  const groups: { key: string; title: string; note: string; rows: OwnerResult[];
                  edge: string | null }[] = [
    { key: "contested", title: "Disputed", edge: tokens.danger,
      note: "The players disagree. Locked until you settle it.",
      rows: queue.contested },
    { key: "unscored", title: "No score yet", edge: tokens.brass,
      note: "Played, but nobody has put a score on it. Either player can, or you can.",
      rows: queue.unscored },
    { key: "pending", title: "Recorded by players", edge: null,
      note: "Scores the players entered. Confirm one to settle it, or leave it be.",
      rows: queue.pending },
    { key: "settled", title: "Settled by you", edge: null,
      note: "Locked, and only you can change them now.",
      rows: queue.settled },
  ];

  const anything = groups.some((g) => g.rows.length);

  if (!anything) {
    return (
      <EmptyState
        title="Nothing to review"
        description="Games appear here the day after they are played, across every club you run."
      />
    );
  }

  return (
    <>
      <Stack spacing={4}>
        {groups.filter((g) => g.rows.length).map((group) => (
          <ResultGroup key={group.key} title={group.title} note={group.note}
            rows={group.rows} edge={group.edge} onOpen={setChosen} />
        ))}
      </Stack>

      {/* The same dialog the club page uses, so a result is settled the same
          way whichever door you came through. The club's own colour, since a
          row here can come from any of them. */}
      <ClubResultDialog
        result={chosen}
        slug={chosen?.club.slug ?? ""}
        faction={clubIdentity(chosen?.club.slug ?? "", chosen?.club.name ?? "").faction}
        onClose={() => setChosen(null)}
      />
    </>
  );
}
