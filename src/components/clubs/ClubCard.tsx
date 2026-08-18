import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import GroupsIcon from "@mui/icons-material/Groups";
import SellIcon from "@mui/icons-material/Sell";
import PlaceIcon from "@mui/icons-material/Place";
import NearMeIcon from "@mui/icons-material/NearMe";
import StatLine from "@/components/ui/StatLine";
import ClubArt from "./ClubArt";
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
        <ClubArt slug={club.slug} name={club.name} image={club.image} />

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

      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.25, flex: 1, p: 2.5 }}>
        <Stack spacing={0.375}>
          <Typography variant="h4" component="h3" sx={{ minWidth: 0 }}>
            <Link href={`/clubs/${club.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
              <Box component="span" sx={{ "&::after": { content: '""', position: "absolute", inset: 0 } }}>
                {club.name}
              </Box>
            </Link>
          </Typography>
          {place ? (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary" }}>
              <PlaceIcon aria-hidden sx={{ fontSize: 16, color: faction.base }} />
              <Typography variant="overline" sx={{ color: "inherit" }}>
                {place}{club.postcodeArea ? ` · ${club.postcodeArea}` : ""}
              </Typography>
            </Stack>
          ) : null}
        </Stack>

        <StatLine
          stats={[
            { label: "Meets", value: club.meetingLabel, icon: CalendarMonthIcon },
            { label: "Tables", value: club.tablesAvailable, icon: TableRestaurantIcon },
            { label: "Members", value: club.memberCount, icon: GroupsIcon },
            { label: "From", value: club.fromPrice, icon: SellIcon },
          ]}
          columns={2}
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

        <Box sx={{ mt: "auto", pt: 0.5 }}>
          <GameChips games={club.featuredGames} faction={faction} max={3} />
        </Box>
      </CardContent>
    </Card>
  );
}
