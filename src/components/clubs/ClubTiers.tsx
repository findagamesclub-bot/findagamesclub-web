import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CheckIcon from "@mui/icons-material/Check";
import { perMonth, yearlySaving } from "@/utils/membership-billing";
import { tokens } from "@/lib/tokens";
import type { MembershipTier, PricingModel } from "@/types/clubDetail";

export function MembershipTiers({ tiers, slug }: { tiers: MembershipTier[]; slug?: string }) {
  return (
    <Box sx={{ display: "grid", gap: 2,
               gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(280px, 1fr))" } }}>
      {tiers.map((tier) => {
        const saving = yearlySaving(tier.billingOptions);
        const monthly = perMonth(tier.billingOptions);
        const headline = tier.billingOptions[0] ?? null;
        const rest = tier.billingOptions.slice(1);

        return (
          <Stack
            key={tier.key}
            sx={{
              borderRadius: 2, overflow: "hidden", height: "100%",
              backgroundColor: tokens.paper,
              // The paid tier is the one being sold, so it carries the weight.
              border: `1px solid ${tier.isFree ? tokens.rule : tokens.brass}`,
              boxShadow: tier.isFree ? "none" : "0 2px 14px rgba(184,134,43,0.14)",
            }}
          >
            <Stack spacing={0.25} sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
              <Stack direction="row" spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="h4" sx={{ fontSize: "1.2rem" }}>{tier.label}</Typography>
                {/* Only the free one is badged. A paid card has its price in
                    large figures directly underneath, so a badge repeating that
                    it costs money says nothing; and the badge used to read
                    "Premium" on every paid tier, which put the word Premium on
                    a card headed "Basic Membership". */}
                {tier.isFree ? (
                  <Chip size="small" label="Free"
                    sx={{ bgcolor: tokens.positive, color: "#fff", fontWeight: 700,
                          fontSize: "0.66rem", height: 22 }} />
                ) : null}
              </Stack>
              {tier.description ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {tier.description}
                </Typography>
              ) : null}
            </Stack>

            {/* Prices in their own panel. Loose in the card they read as more
                bullet points, which is what made three cadences look like one. */}
            <Stack spacing={1.25}
              sx={{ px: 2.5, py: 2, backgroundColor: tokens.surface,
                    borderTop: `1px solid ${tokens.rule}`,
                    borderBottom: `1px solid ${tokens.rule}` }}>
              {headline ? (
                <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "2rem",
                                    fontWeight: 700, lineHeight: 1 }}>
                    {headline.price}
                  </Typography>
                  <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                    {headline.cadence === "one-off" ? "once" : `a ${headline.cadence}`}
                  </Typography>
                </Stack>
              ) : (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem",
                                  fontWeight: 700 }}>
                  Free
                </Typography>
              )}

              {rest.map((option) => {
                const isYear = option.cadence === "year";
                return (
                  <Stack key={option.id} direction="row" spacing={1}
                    sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={0.875} sx={{ alignItems: "baseline" }}>
                      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                        {option.label}
                      </Typography>
                      {/* Two months free, said out loud. Nobody should have to
                          multiply the monthly price by twelve to notice. */}
                      {isYear && saving ? (
                        <Box component="span"
                          sx={{ px: 0.75, py: 0.125, borderRadius: 0.75,
                                backgroundColor: tokens.brassSoft, color: "#5c4310",
                                fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                fontWeight: 700 }}>
                          SAVE £{saving.amount}
                        </Box>
                      ) : null}
                    </Stack>
                    <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1rem",
                                      fontWeight: 600 }}>
                      {option.price}
                    </Typography>
                  </Stack>
                );
              })}

              {saving && monthly ? (
                <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                  Yearly works out at {monthly}.
                </Typography>
              ) : null}
            </Stack>

            <Stack spacing={1} sx={{ px: 2.5, py: 2, flex: 1 }}>
              {tier.benefits.length ? (
                <>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                    letterSpacing: "0.12em", color: tokens.inkMuted,
                                    fontWeight: 700 }}>
                    {tier.benefits.length} {tier.benefits.length === 1 ? "PRIVILEGE" : "PRIVILEGES"}
                  </Typography>
                  <Stack component="ul" spacing={0.75} sx={{ m: 0, p: 0, listStyle: "none" }}>
                    {tier.benefits.slice(0, 6).map((b, i) => (
                      <Stack key={i} component="li" direction="row" spacing={0.875}
                        sx={{ alignItems: "flex-start" }}>
                        <CheckIcon aria-hidden
                          sx={{ fontSize: 15, color: tokens.brass, mt: 0.3, flexShrink: 0 }} />
                        <Typography variant="body2">{b}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  Membership, with no extras on top.
                </Typography>
              )}

              {/* Pinned to the bottom so cards of different lengths still line
                  their actions up. */}
              {tier.benefits.length > 6 && slug ? (
                <Box sx={{ mt: "auto", pt: 1 }}>
                  <NextLink href={`/clubs/${slug}/membership`} style={{ textDecoration: "none" }}>
                    <Typography variant="body2"
                      sx={{ color: tokens.brand, fontWeight: 600,
                            "&:hover": { textDecoration: "underline" } }}>
                      See all {tier.benefits.length} privileges
                    </Typography>
                  </NextLink>
                </Box>
              ) : null}
            </Stack>
          </Stack>
        );
      })}
    </Box>
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
