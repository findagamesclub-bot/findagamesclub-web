import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import RemoveIcon from "@mui/icons-material/Remove";
import { tokens, type Faction } from "@/lib/tokens";
import type { MembershipTier } from "@/types/clubDetail";
import type { ComparisonRow } from "@/utils/tier-comparison";

/**
 * Every tier's privileges, side by side.
 *
 * A real table, because that is what this is: privileges down, tiers across.
 * The tier cards on the club page can only ever say "and 14 more"; the point
 * of this page is that nothing is hidden behind a count.
 *
 * The first column sticks on a narrow screen. Scrolling a matrix sideways and
 * losing the row labels leaves cells that mean nothing.
 */
export default function TierComparison({
  tiers, rows, faction, yourTierKey,
}: {
  tiers: MembershipTier[];
  rows: ComparisonRow[];
  faction: Faction;
  /** Marked so a member can find their own column without counting across. */
  yourTierKey: string | null;
}) {
  const head = {
    position: "sticky" as const,
    top: 0,
    zIndex: 2,
    backgroundColor: tokens.paper,
    borderBottom: `2px solid ${tokens.rule}`,
  };

  return (
    <Box sx={{ overflowX: "auto", border: `1px solid ${tokens.rule}`,
               borderRadius: 2, backgroundColor: tokens.paper }}>
      <Box component="table"
        sx={{ borderCollapse: "collapse", width: "100%", minWidth: 520 + tiers.length * 40 }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" scope="col"
              sx={{ ...head, position: "sticky", left: 0, zIndex: 3, textAlign: "left",
                    px: 2, py: 1.75, minWidth: 220,
                    borderRight: `1px solid ${tokens.rule}` }}>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                letterSpacing: "0.12em", color: tokens.inkMuted, fontWeight: 700 }}>
                PRIVILEGE
              </Typography>
            </Box>

            {tiers.map((tier) => {
              const yours = tier.key === yourTierKey;
              return (
                <Box component="th" scope="col" key={tier.key}
                  sx={{ ...head, px: 1.5, py: 1.5, minWidth: 132,
                        backgroundColor: yours ? faction.soft : tokens.paper }}>
                  <Stack spacing={0.5} sx={{ alignItems: "center" }}>
                    <Typography variant="subtitle2"
                      sx={{ fontFamily: "var(--font-display)",
                            color: yours ? faction.deep : tokens.ink }}>
                      {tier.label}
                    </Typography>
                    {tier.billingOptions.length ? (
                      <Stack spacing={0.125} sx={{ alignItems: "center" }}>
                        {tier.billingOptions.map((option) => (
                          <Typography key={option.id}
                            sx={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem",
                                  color: tokens.inkMuted, whiteSpace: "nowrap" }}>
                            {option.price} <Box component="span" sx={{ opacity: 0.75 }}>
                              {option.label.toLowerCase()}
                            </Box>
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                                        color: tokens.inkMuted }}>
                        Free
                      </Typography>
                    )}
                    {yours ? (
                      <Chip size="small" label="Yours"
                        sx={{ height: 20, fontSize: "0.62rem", fontWeight: 700,
                              bgcolor: faction.base, color: "#fff" }} />
                    ) : null}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box component="tbody">
          {rows.map((row, i) => (
            <Box component="tr" key={row.label}
              sx={{ backgroundColor: i % 2 ? tokens.surface : tokens.paper }}>
              <Box component="th" scope="row"
                sx={{ position: "sticky", left: 0, zIndex: 1, textAlign: "left",
                      px: 2, py: 1.25, fontWeight: 500,
                      backgroundColor: "inherit",
                      borderRight: `1px solid ${tokens.rule}` }}>
                <Typography variant="body2">{row.label}</Typography>
              </Box>

              {row.values.map((value, index) => {
                const yours = tiers[index]?.key === yourTierKey;
                return (
                  <Box component="td" key={tiers[index]?.key ?? index}
                    sx={{ px: 1.5, py: 1.25, textAlign: "center",
                          backgroundColor: yours ? faction.soft : "inherit" }}>
                    {value ? (
                      // A tick alone cannot say "10%", and a number alone does
                      // not read as included. Both, so neither has to carry it.
                      <Stack direction="row" spacing={0.5}
                        sx={{ alignItems: "center", justifyContent: "center" }}>
                        <CheckIcon aria-hidden sx={{ fontSize: 15, color: faction.base }} />
                        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                          {value === "Yes" ? "Included" : value}
                        </Typography>
                      </Stack>
                    ) : (
                      <RemoveIcon titleAccess="Not included"
                        sx={{ fontSize: 15, color: tokens.rule }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
