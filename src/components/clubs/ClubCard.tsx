import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import SellIcon from "@mui/icons-material/Sell";
import PlaceIcon from "@mui/icons-material/Place";
import NearMeIcon from "@mui/icons-material/NearMe";
import StatLine from "@/components/ui/StatLine";
import StarRating from "@/components/ui/StarRating";
import FacilityChips from "./FacilityChips";
import SocialLinks from "./SocialLinks";
import ClubArt from "./ClubArt";
import ClubLogo from "./ClubLogo";
import GameChips from "./GameChips";
import { mono, tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import type { ClubSummary } from "@/types/club";

export default function ClubCard({ club }: { club: ClubSummary }) {
  const place = [club.neighbourhood, club.city].filter(Boolean).join(" · ");
  const { faction } = clubIdentity(club.slug, club.name);

  return (
    <Card
      component="article"
      sx={{
        position: "relative", // anchors the stretched link
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
        "@media (hover: hover)": {
          "&:hover": {
            transform: "translateY(-3px)",
            borderColor: faction.base,
            boxShadow: "0 12px 28px rgba(16,27,45,0.13)",
          },
        },
        "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
        "&:focus-within": { borderColor: faction.base },
      }}
    >
      <Box sx={{ position: "relative" }}>
        <ClubArt slug={club.slug} name={club.name} image={club.image}
          backdrop={club.logoUrl} ratio="16 / 10" />

        {/* Overlapping the artwork, so a grid of nineteen clubs can be scanned
            by mark rather than read by name. */}
        <Box sx={{ position: "absolute", left: 16, bottom: -22, zIndex: 1 }}>
          <ClubLogo slug={club.slug} name={club.name} logoUrl={club.logoUrl}
            size={48} ring={tokens.paper} />
        </Box>

        {club.isFeatured ? (
          <Box
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              backgroundColor: tokens.brass,
              color: "#FFFFFF",
              fontFamily: "var(--font-display)",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              px: 1, py: 0.375,
              borderRadius: "2px",
            }}
          >
            Featured
          </Box>
        ) : null}

        {club.distanceMiles != null ? (
          <Box
            sx={{
              position: "absolute",
              bottom: 12,
              right: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              backgroundColor: "rgba(16,27,45,0.86)",
              color: "#FFFFFF",
              fontFamily: mono,
              fontSize: "0.82rem",
              fontWeight: 500,
              px: 0.875, py: 0.375,
              borderRadius: "2px",
            }}
          >
            <NearMeIcon aria-hidden sx={{ fontSize: 14 }} />
            {club.distanceMiles.toFixed(1)} mi
          </Box>
        ) : null}
      </Box>

      {/* Extra top padding clears the plate hanging over this edge. */}
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, flex: 1,
                         p: 2.5, pt: 3.75, "&:last-child": { pb: 2.5 } }}>
        <Stack spacing={0.375}>
          <Typography variant="h4" component="h3" sx={{ minWidth: 0 }}>
            <Link href={`/clubs/${club.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
              <Box component="span" sx={{ "&::after": { content: '""', position: "absolute", inset: 0 } }}>
                {club.name}
              </Box>
            </Link>
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
          >
            {place ? (
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary" }}>
                <PlaceIcon aria-hidden sx={{ fontSize: 16, color: faction.base }} />
                {/* Town and postcode only. The neighbourhood pushed this onto a
                    second line on most cards, and it is the least useful part
                    when you are scanning a grid. */}
                <Typography variant="overline" sx={{ color: "inherit" }} noWrap>
                  {club.city}{club.postcodeArea ? ` · ${club.postcodeArea}` : ""}
                  {club.formats.length ? (
                    <Box component="span" sx={{ color: faction.base }}>
                      {` · ${club.formats[0]}`}
                    </Box>
                  ) : null}
                </Typography>
              </Stack>
            ) : <span />}
            {/* Only when someone has actually reviewed it. An empty row of grey
                stars reads as "rated zero", which is not what no reviews means. */}
            {club.rating ? (
              <StarRating value={club.rating.average}
                caption={`${club.rating.average.toFixed(1)} · ${club.rating.count} ${club.rating.count === 1 ? "review" : "reviews"}`} />
            ) : null}
          </Stack>


        </Stack>

        <StatLine
          stats={[
            { label: "Meets", value: club.meetingLabel, icon: CalendarMonthIcon },
            { label: "Age", value: club.ages, icon: PersonIcon },
            // Same chain as the club page: live count, then the club's own figure.
            { label: "Members", value: club.joinedCount || "Open", icon: GroupsIcon },
            { label: "From", value: club.fromPrice, icon: SellIcon },
          ]}
          columns={2}
          dense
        />

        {club.summary ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {club.summary}
          </Typography>
        ) : null}

        <Stack spacing={1.25} sx={{ pt: 0.25 }}>
          <GameChips games={club.featuredGames} faction={faction} max={3} />
          {club.facilities.length ? <FacilityChips values={club.facilities.slice(0, 4)} /> : null}
          {club.socialLinks?.length ? (
            <SocialLinks links={club.socialLinks} slug={club.slug} name={club.name} size="small" />
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
