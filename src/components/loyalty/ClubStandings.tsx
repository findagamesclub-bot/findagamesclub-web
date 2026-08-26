import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import MetalPlate from "@/components/ui/MetalPlate";
import { tierFor, type LoyaltyTier } from "@/utils/loyalty";
import { initialsOf } from "@/utils/format";
import { metalOf, tokens, type Faction } from "@/lib/tokens";

type Standing = { profileId: string; name: string; available: number; lifetime: number };

/**
 * The club's own view of its programme.
 *
 * An owner has no wallet — they run the scheme rather than earn from it — so
 * this is what the loyalty page means to them: who is on what rung, and how
 * much the club has issued. Ordered by lifetime, which is the ladder's order.
 */
export default function ClubStandings({
  standings, tiers, faction,
}: {
  standings: Standing[];
  tiers: LoyaltyTier[];
  faction: Faction;
}) {
  if (!standings.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nobody has earned anything yet. Points start the moment you approve a member.
      </Typography>
    );
  }

  const issued = standings.reduce((n, s) => n + s.lifetime, 0);
  const unspent = standings.reduce((n, s) => n + s.available, 0);

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: "wrap", alignItems: "baseline" }}>
        <Figure value={standings.length}
          label={standings.length === 1 ? "member earning" : "members earning"} />
        <Figure value={issued} label="points issued" />
        <Figure value={unspent} label="unspent" emphasis />
      </Stack>

      <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden" }}>
        {standings.map((person, i) => {
          const standing = tierFor(person.lifetime, tiers);
          const metal = metalOf(standing.tier?.tone);

          return (
            <NextLink key={person.profileId} href={`/members/${person.profileId}`}
              style={{ textDecoration: "none", color: "inherit" }}>
              <Stack direction="row" spacing={2}
                sx={{ px: 2, py: 1.5, alignItems: "center",
                      borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}`,
                      "&:hover": { backgroundColor: metal.soft } }}>
                <Box sx={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                           display: "grid", placeItems: "center",
                           backgroundColor: faction.soft, color: faction.deep }}>
                  <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                    fontSize: "0.74rem" }}>
                    {initialsOf(person.name)}
                  </Typography>
                </Box>

                <Typography variant="subtitle2"
                  sx={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)" }}>
                  {person.name}
                </Typography>

                <MetalPlate label={standing.tier?.label ?? "Bronze"}
                  tone={standing.tier?.tone ?? "bronze"} size="small" />

                <Stack spacing={0} sx={{ alignItems: "flex-end", flexShrink: 0, minWidth: 68 }}>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.95rem",
                                    fontWeight: 700, lineHeight: 1.1 }}>
                    {person.lifetime.toLocaleString("en-GB")}
                  </Typography>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                                    letterSpacing: "0.08em", color: tokens.inkMuted }}>
                    {person.available.toLocaleString("en-GB")} TO SPEND
                  </Typography>
                </Stack>
              </Stack>
            </NextLink>
          );
        })}
      </Box>
    </Stack>
  );
}

function Figure({ value, label, emphasis }: { value: number; label: string; emphasis?: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.4rem", fontWeight: 700,
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
