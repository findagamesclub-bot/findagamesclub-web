import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import TierLadder from "@/components/account/TierLadder";
import { metalOf, mono, tokens } from "@/lib/tokens";
import type { LoyaltyCard } from "@/services/dashboard.service";

/**
 * Where the member stands on each club's points ladder.
 *
 * Legacy puts this on the dashboard and it belongs there: points are earned by
 * doing the things the rest of this page is about, and a member should not
 * have to open a club to find out they are 135 short of the top tier.
 *
 * The bar is struck in the tier's own metal, which is the one place in the app
 * where colour means rank rather than identity. A club that has invented its
 * own tier name falls back to bronze rather than to no colour at all.
 */
export default function LoyaltyProgress({ cards }: { cards: LoyaltyCard[] }) {
  if (!cards.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        None of your clubs run a points scheme yet.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.25}>
      {cards.map((card) => {
        const metal = metalOf(card.tone);
        // Lifetime never goes down when points are spent, so the gap between
        // the two counters is exactly what has been redeemed.
        const redeemed = Math.max(0, card.lifetime - card.available);
        const worth = card.pointValue !== null && card.available > 0
          ? (card.available * card.pointValue)
          : null;

        return (
          <Stack key={card.clubSlug} spacing={0.9}>
            <Stack direction="row" spacing={1}
              sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
              <Box sx={{ minWidth: 0 }}>
                <NextLink href={`/clubs/${card.clubSlug}/loyalty`}
                  style={{ textDecoration: "none", color: tokens.ink }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {card.clubName}
                  </Typography>
                </NextLink>
                <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                  color: tokens.inkMuted, mt: 0.25 }}>
                  {[
                    card.tierLabel,
                    `${card.available.toLocaleString("en-GB")} pts available`,
                    // Only when the club has priced a point. Inventing a value
                    // would tell a member their points are worth money at a
                    // club that has never said so.
                    worth !== null
                      ? worth.toLocaleString("en-GB",
                          { style: "currency", currency: "GBP" })
                      : null,
                  ].filter(Boolean).join(" · ")}
                </Typography>
              </Box>

              <Chip metal={metal}>
                {card.toNext !== null && card.nextLabel
                  ? `${card.toNext} to ${card.nextLabel}`
                  : "TOP TIER"}
              </Chip>
            </Stack>

            <TierLadder
              tiers={card.tiers}
              lifetime={card.lifetime}
              progress={card.progress}
              currentLabel={card.tierLabel}
            />

            {/* Only once they have spent something. "0 redeemed" is a line of
                text saying nothing happened. */}
            {redeemed > 0 ? (
              <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                                color: tokens.inkMuted }}>
                {card.lifetime.toLocaleString("en-GB")} EARNED ALL TIME ·{" "}
                {redeemed.toLocaleString("en-GB")} REDEEMED
              </Typography>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}

/** The struck-metal pill on the right of a row. */
function Chip({
  metal, children,
}: {
  metal: ReturnType<typeof metalOf>;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ flexShrink: 0, px: 1, py: 0.4, borderRadius: 1,
               backgroundColor: metal.soft, border: `1px solid ${metal.base}33` }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                        letterSpacing: "0.04em", color: metal.ink, whiteSpace: "nowrap" }}>
        {children}
      </Typography>
    </Box>
  );
}
