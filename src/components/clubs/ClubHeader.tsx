import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import GroupsIcon from "@mui/icons-material/Groups";
import SellIcon from "@mui/icons-material/Sell";
import PlaceIcon from "@mui/icons-material/Place";
import StatLine from "@/components/ui/StatLine";
import ClubArt from "./ClubArt";
import { tokens } from "@/lib/tokens";
import type { ClubDetail } from "@/types/clubDetail";

export default function ClubHeader({
  club,
  /** Members get a way through to booking from the stat that prompts it. */
  canBook = false,
}: { club: ClubDetail; canBook?: boolean }) {
  const place = [club.neighbourhood, club.city].filter(Boolean).join(" · ");
  const banner = club.images[0] ?? null;

  return (
    <Stack spacing={2.5} component="header">
      <Box sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden" }}>
        <ClubArt
          slug={club.slug}
          name={club.name}
          image={banner}
          ratio="21 / 9"
          showPlate={false}
        />

        {/* The name sits on the artwork, so the page opens with the club rather
            than with a heading above a picture of it. */}
        <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <PlaceIcon aria-hidden sx={{ fontSize: 17, color: tokens.brassOnDark }} />
              <Typography variant="overline" sx={{ color: "#E8EFF8" }}>
                {place}{club.venue.district ? ` · ${club.venue.district}` : ""}
              </Typography>
            </Stack>
            {club.isFeatured ? (
              <Box
                component="span"
                sx={{
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
          </Stack>

          <Typography
            variant="h1"
            sx={{
              color: "#FFFFFF",
              fontSize: { xs: "2rem", sm: "2.6rem", md: "3.2rem" },
              textShadow: "0 2px 18px rgba(6,14,28,0.55)",
            }}
          >
            {club.name}
          </Typography>
        </Box>
      </Box>

      {club.summary ? (
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 680 }}>
          {club.summary}
        </Typography>
      ) : null}

      {club.announcement ? (
        <Alert severity="info">
          {club.announcement}
        </Alert>
      ) : null}

      <StatLine
        stats={[
          { label: "Meets", value: club.meetingLabel, icon: CalendarMonthIcon },
          {
            label: "Tables",
            value: club.tablesAvailable,
            icon: TableRestaurantIcon,
            // The club page runs to 3600px and the booking panel sits below the
            // fold on a laptop. "How many tables" is asked by somebody about to
            // book one, so the answer carries the way there.
            href: canBook && (club.tablesAvailable ?? 0) > 0
              ? `/clubs/${club.slug}/bookings` : undefined,
            linkLabel: "Book",
          },
          { label: "Members", value: club.memberCount, icon: GroupsIcon },
          { label: "From", value: club.fromPrice, icon: SellIcon },
        ]}
      />
    </Stack>
  );
}
