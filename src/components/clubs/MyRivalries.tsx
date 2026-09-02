import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { Rivalry } from "@/services/games.service";
import MonoLabel from "@/components/ui/MonoLabel";

/**
 * The reader's own pairs, as a row of shortcuts above the table.
 *
 * Legacy calls this "Your rivalries" and it is not decoration: at a club with
 * two hundred pairings your own row is on page seven, so highlighting it in the
 * table finds nobody. Naming the opponent rather than repeating both names,
 * since one of the two is always you.
 */
export default function MyRivalries({
  rivalries, viewerId, faction, slug,
}: {
  rivalries: Rivalry[];
  viewerId: string;
  faction: Faction;
  slug: string;
}) {
  const mine = rivalries.filter((r) => r.one.id === viewerId || r.two.id === viewerId);
  if (!mine.length) return null;

  return (
    <Box>
      <MonoLabel>YOUR RIVALRIES</MonoLabel>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {mine.map((r) => {
          const them = r.one.id === viewerId ? r.two : r.one;
          // The record is written from member one's side, so it needs turning
          // round when the reader is member two.
          const record = r.one.id === viewerId
            ? r.record
            : `${r.two.wins}-${r.draws}-${r.one.wins}`;

          return (
            <NextLink key={r.key} href={`/clubs/${slug}/rivalries/${r.key.replace(":", "_")}`}
              style={{ textDecoration: "none" }}>
              <Stack direction="row" spacing={1.25}
                sx={{ alignItems: "center", minHeight: 44, px: 1.75, borderRadius: 999,
                      border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                      transition: "border-color 150ms ease, background-color 150ms ease",
                      "&:hover": { borderColor: faction.base, backgroundColor: faction.soft } }}>
                <Typography variant="body2" sx={{ color: tokens.ink }}>
                  {`vs ${them.name}`}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.78rem", fontWeight: 700,
                                  fontVariantNumeric: "tabular-nums", color: faction.deep }}>
                  {record}
                </Typography>
              </Stack>
            </NextLink>
          );
        })}
      </Stack>
    </Box>
  );
}
