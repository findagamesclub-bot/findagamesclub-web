import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import MetalPlate from "@/components/ui/MetalPlate";
import { metalOf, tokens } from "@/lib/tokens";
import type { LoyaltyTier } from "@/utils/loyalty";

/**
 * The whole ladder, with the rungs already climbed marked.
 *
 * Shown to everybody, including people who have not joined — the ladder is a
 * reason to join, and a club that has invented a "Rock Star" tier at 2,000
 * points wants that seen.
 */
export default function TierLadder({
  tiers, lifetime,
}: {
  tiers: (LoyaltyTier & { rewards?: string[] })[];
  lifetime: number;
}) {
  const ladder = [...tiers].sort((a, b) => a.pointsRequired - b.pointsRequired);

  return (
    <Stack spacing={1.25}>
      {ladder.map((tier) => {
        const reached = lifetime >= tier.pointsRequired;
        const metal = metalOf(tier.tone);

        return (
          <Stack key={tier.label} direction="row" spacing={2}
            sx={{ p: 1.5, borderRadius: 1.5, alignItems: "center",
                  border: `1px solid ${reached ? metal.base : tokens.rule}`,
                  backgroundColor: reached ? metal.soft : "transparent",
                  opacity: reached ? 1 : 0.72 }}>
            <MetalPlate label={tier.label} tone={tier.tone} size="small" />

            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                letterSpacing: "0.08em",
                                color: reached ? metal.ink : tokens.inkMuted }}>
                {tier.pointsRequired === 0
                  ? "FROM THE START"
                  : `${tier.pointsRequired.toLocaleString("en-GB")} POINTS`}
              </Typography>
              {tier.rewards?.length ? (
                <Typography variant="body2" sx={{ color: reached ? tokens.ink : tokens.inkMuted }}>
                  {tier.rewards.join(" · ")}
                </Typography>
              ) : null}
            </Stack>

            {reached ? (
              <Box sx={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                         display: "grid", placeItems: "center", backgroundColor: metal.base }}>
                <CheckIcon sx={{ fontSize: 15, color: "#fff" }} />
              </Box>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
