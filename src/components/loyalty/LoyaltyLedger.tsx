"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { messageTime } from "@/utils/dates";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { tokens } from "@/lib/tokens";
import type { LoyaltyEntry } from "@/types/loyalty";
import { PER_PAGE } from "@/utils/paging";

/**
 * The ledger.
 *
 * No counter and no icons — a ledger aligns right and lets the figures form a
 * column you can read down. That column is the whole point of it, and anything
 * in the left margin competes with it.
 */
/**
 * A ledger page. Ten rather than fifteen: it sits in a column beside the
 * ladder now, and a history that runs on past everything next to it is the
 * scrolling this page was rearranged to stop.
 */
const LEDGER_PAGE = PER_PAGE.rows;

export default function LoyaltyLedger({ entries }: { entries: LoyaltyEntry[] }) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(entries, LEDGER_PAGE, top);

  if (!entries.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing yet. Points arrive when you join, book a table, or take event tickets.
      </Typography>
    );
  }

  return (
    <>
    <Box ref={top} sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
      {paged.shown.map((entry, i) => {
        const negative = entry.points < 0;
        return (
          <Stack key={entry.id} direction="row" spacing={2}
            sx={{ px: 2, py: 1.4, alignItems: "baseline", justifyContent: "space-between",
                  borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                  backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
            <Stack spacing={0.15} sx={{ minWidth: 0 }}>
              <Typography variant="body2">{entry.description}</Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem",
                                letterSpacing: "0.08em", color: tokens.inkMuted }}>
                {messageTime(entry.createdAt)}
              </Typography>
            </Stack>

            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.95rem", fontWeight: 700,
                              flexShrink: 0,
                              color: negative ? tokens.inkMuted : tokens.positive }}>
              {negative ? "−" : "+"}{Math.abs(entry.points)}
            </Typography>
          </Stack>
        );
      })}
    </Box>

    <Pager page={paged.page} total={paged.total} noun="entries"
      size={LEDGER_PAGE} onChange={paged.goTo} />
    </>
  );
}
