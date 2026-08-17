import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";
import type { MembershipTier, PricingModel } from "@/types/clubDetail";

export function MembershipTiers({ tiers }: { tiers: MembershipTier[] }) {
  return (
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
      {tiers.map((tier) => (
        <Card key={tier.key} sx={{ flex: "1 1 260px", borderColor: tier.isBasic ? undefined : tokens.brass }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="h4">{tier.label}</Typography>
                {!tier.isBasic ? (
                  <Chip size="small" label="Premium" sx={{ bgcolor: tokens.brassSoft, color: "#5c4310" }} />
                ) : null}
              </Stack>

              {tier.price ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.35rem", fontWeight: 600 }}>
                  {tier.price}
                  {tier.priceDuration ? (
                    <Typography component="span" variant="body2" color="text.secondary"> / {tier.priceDuration}</Typography>
                  ) : null}
                </Typography>
              ) : null}

              {tier.description ? (
                <Typography variant="body2" color="text.secondary">{tier.description}</Typography>
              ) : null}

              {tier.benefits.length ? (
                <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
                  {tier.benefits.map((b, i) => (
                    <Typography key={i} component="li" variant="body2">{b}</Typography>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

export function PricingList({ models }: { models: PricingModel[] }) {
  return (
    <Stack spacing={1}>
      {models.map((m) => (
        <Stack key={m.label} direction="row" spacing={2}
          sx={{ justifyContent: "space-between", alignItems: "baseline", py: 0.75,
                borderBottom: `1px solid ${tokens.rule}` }}>
          <Stack>
            <Typography variant="subtitle1">{m.label}</Typography>
            {m.notes ? <Typography variant="body2" color="text.secondary">{m.notes}</Typography> : null}
          </Stack>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 500, whiteSpace: "nowrap" }}>
            {m.price || "—"}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
