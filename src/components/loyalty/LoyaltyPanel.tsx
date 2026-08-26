import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MetalPlate, { ProgressRule } from "@/components/ui/MetalPlate";
import { tokens } from "@/lib/tokens";
import type { LoyaltyWallet } from "@/types/loyalty";

/**
 * A member's own standing, on the club page.
 *
 * Two figures, and they mean different things: available is what they can
 * spend, lifetime is what the plate was struck from. Spending must never
 * demote anybody, so the two are shown apart rather than as one balance.
 */
export default function LoyaltyPanel({ wallet }: { wallet: LoyaltyWallet }) {
  const tone = wallet.tier?.tone ?? "bronze";

  return (
    <Stack spacing={2.25}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}
        sx={{ alignItems: { sm: "center" } }}>
        <MetalPlate label={wallet.tier?.label ?? "Bronze"} tone={tone} />

        <Stack direction="row" spacing={3.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Figure value={wallet.available} label="to spend" emphasis />
          <Figure value={wallet.lifetime} label="earned all time" />
        </Stack>
      </Stack>

      {wallet.next ? (
        <Stack spacing={0.75}>
          <ProgressRule value={wallet.progress} tone={tone} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            <Box component="span" sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                        color: tokens.ink }}>
              {wallet.toNext}
            </Box>{" "}
            more to {wallet.next.label}.
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Top of the ladder. There is nothing above {wallet.tier?.label}.
        </Typography>
      )}

      {wallet.rewards.length ? (
        <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 1.75 }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.12em", color: tokens.inkMuted, mb: 0.75 }}>
            WHAT {(wallet.tier?.label ?? "").toUpperCase()} GETS YOU
          </Typography>
          <Stack spacing={0.4}>
            {wallet.rewards.map((reward) => (
              <Typography key={reward} variant="body2">{reward}</Typography>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

function Figure({ value, label, emphasis }: { value: number; label: string; emphasis?: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.6rem", fontWeight: 700,
                        lineHeight: 1, color: emphasis ? tokens.brass : tokens.ink }}>
        {value.toLocaleString("en-GB")}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
