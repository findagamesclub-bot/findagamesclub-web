import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { messageTime } from "@/utils/dates";
import { tokens } from "@/lib/tokens";
import type { LoyaltyEntry } from "@/types/loyalty";

/**
 * The ledger.
 *
 * No counter and no icons — a ledger aligns right and lets the figures form a
 * column you can read down. That column is the whole point of it, and anything
 * in the left margin competes with it.
 */
export default function LoyaltyLedger({ entries }: { entries: LoyaltyEntry[] }) {
  if (!entries.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing yet. Points arrive when you join, book a table, or take event tickets.
      </Typography>
    );
  }

  return (
    <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
      {entries.map((entry, i) => {
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
  );
}
