import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { metalOf, mono, tokens } from "@/lib/tokens";

export type Rung = { label: string; pointsRequired: number; tone: string };

/**
 * The whole points ladder, with the member standing on it.
 *
 * A bar from the current tier to the next one answers "how far to the next
 * rung" and nothing else. It cannot say how long the ladder is, what is at the
 * top of it, or how far up the member already is, which is most of what
 * somebody looking at a loyalty scheme wants to know.
 *
 * Stops are spaced evenly rather than by points required. The real thresholds
 * are 0, 100, 250, 500 and 1000, and spacing to those crushes the first three
 * rungs into the left-hand inch: a member sitting on Silver would appear to
 * have barely started. Progress inside the current rung is interpolated from
 * the figure the wallet already works out, so the marker still lands honestly
 * between its two stops.
 *
 * Only three labels are drawn: both ends and wherever the member is. Six tier
 * names across a half-width panel collide, and a club that has invented a tier
 * called "Rock Star" makes that worse rather than better.
 */
export default function TierLadder({
  tiers, lifetime, progress, currentLabel,
}: {
  tiers: Rung[];
  lifetime: number;
  /** 0-1 through the current rung, from the wallet. */
  progress: number;
  currentLabel: string | null;
}) {
  if (tiers.length < 2) return null;

  // By name where the wallet gave one, because two rungs can share a threshold
  // and the name is what the member was actually told they hold.
  const byName = currentLabel
    ? tiers.findIndex((t) => t.label === currentLabel)
    : -1;
  const reached = tiers.reduce(
    (best, tier, i) => (lifetime >= tier.pointsRequired ? i : best), -1);
  const current = byName >= 0 ? byName : reached;

  const last = tiers.length - 1;
  const at = (i: number) => (i / last) * 100;
  const fill = current < 0
    ? 0
    : Math.min(100, at(current) + (progress * (100 / last)));

  return (
    // Padded by half a stop, or the first and last dots hang off the ends of
    // their own rail.
    <Box sx={{ pt: 0.5, px: "8px" }}>
      <Box sx={{ position: "relative", height: 14 }}>
        {/* The rail, behind everything, inset so the end stops sit on it
            rather than half off the end of it. */}
        <Box sx={{ position: "absolute", left: 0, right: 0, top: 5, height: 4,
                   borderRadius: 2, backgroundColor: tokens.surface,
                   border: `1px solid ${tokens.rule}` }} />
        <Box sx={{ position: "absolute", left: 0, top: 5, height: 4, width: `${fill}%`,
                   borderRadius: 2,
                   backgroundImage: `linear-gradient(90deg, ${metalOf(tiers[0]!.tone).base} 0%, `
                     + `${metalOf(tiers[Math.max(0, current)]!.tone).deep} 100%)` }} />

        {tiers.map((tier, i) => {
          const metal = metalOf(tier.tone);
          const passed = current >= i;
          const here = current === i;
          const size = here ? 14 : 10;
          return (
            <Box key={tier.label} title={`${tier.label} · ${tier.pointsRequired} pts`}
              sx={{ position: "absolute", top: 7, left: `${at(i)}%`,
                    transform: "translate(-50%, -50%)",
                    width: size, height: size, borderRadius: "50%",
                    backgroundColor: passed ? metal.base : tokens.paper,
                    border: `2px solid ${passed ? metal.deep : tokens.rule}`,
                    ...(here
                      ? { boxShadow: `0 0 0 3px ${metal.soft}` }
                      : {}) }} />
          );
        })}
      </Box>

      <Box sx={{ position: "relative", height: 16, mt: 0.75 }}>
        <Caption sx={{ left: 0 }}>{tiers[0]!.label}</Caption>
        <Caption sx={{ right: 0, textAlign: "right" }}>{tiers[last]!.label}</Caption>
        {/* Skipped at either end, where the end caption already names it. */}
        {current > 0 && current < last ? (
          <Caption strong tone={tiers[current]!.tone}
            sx={{ left: `${at(current)}%`, transform: "translateX(-50%)" }}>
            {tiers[current]!.label}
          </Caption>
        ) : null}
      </Box>
    </Box>
  );
}

function Caption({
  children, sx, strong, tone,
}: {
  children: React.ReactNode;
  sx?: object;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <Typography
      component="span"
      sx={{ position: "absolute", top: 0, fontFamily: mono, fontSize: "0.6rem",
            letterSpacing: "0.08em", whiteSpace: "nowrap",
            fontWeight: strong ? 700 : 500,
            color: strong ? metalOf(tone).ink : tokens.inkMuted,
            ...sx }}>
      {String(children).toUpperCase()}
    </Typography>
  );
}
