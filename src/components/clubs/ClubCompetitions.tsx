import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CompetitionCard from "./CompetitionCard";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CompetitionOverview } from "@/services/competitions.service";

/**
 * The club page's share of competitive play: what is running now, capped, with
 * the way to the rest.
 *
 * A club with twenty leagues would otherwise own the page. Same treatment as
 * its events and its members, both of which show a few and link on.
 */
export default function ClubCompetitions({
  overview, slug, faction,
}: {
  overview: CompetitionOverview;
  slug: string;
  faction: Faction;
}) {
  const { featured, activeCount, completedCount } = overview;
  const total = activeCount + completedCount;
  const more = total > featured.length;

  return (
    <Stack spacing={2}>
      {activeCount ? null : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nothing running at the moment. The last one finished like this.
        </Typography>
      )}

      {featured.map((competition) => (
        <CompetitionCard key={competition.id} competition={competition} faction={faction} />
      ))}

      {/* Always here, not only when there are more. Round-by-round history is
          deliberately not fetched for the club page, so this link is the only
          way to it. */}
      <NextLink href={`/clubs/${slug}/competitions`} style={{ textDecoration: "none" }}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between",
                  px: 2.25, py: 1.5, borderRadius: 2,
                  border: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface,
                  "&:hover": { borderColor: faction.base } }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
              {more ? `SHOWING ${featured.length} OF ${total}` : "ROUND BY ROUND"}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                {more ? "All leagues and campaigns" : "Full results history"}
              </Typography>
              <ArrowForwardIcon sx={{ fontSize: 16, color: tokens.brand }} />
            </Stack>
          </Stack>
      </NextLink>
    </Stack>
  );
}
