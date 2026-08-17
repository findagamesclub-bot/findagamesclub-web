import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import StatLine from "@/components/ui/StatLine";
import { tokens } from "@/lib/tokens";
import type { ClubSummary } from "@/types/club";

export default function ClubCard({ club }: { club: ClubSummary }) {
  const place = [club.neighbourhood, club.city].filter(Boolean).join(" · ");

  return (
    <Card
      component="article"
      sx={{
        position: "relative", // anchors the stretched link
        height: "100%",
        display: "flex",
        "&:focus-within": { borderColor: tokens.brand },
      }}
    >
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%", p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <Typography variant="h4" component="h3" sx={{ minWidth: 0 }}>
            <Link href={`/clubs/${club.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
              <Box component="span" sx={{ "&::after": { content: '""', position: "absolute", inset: 0 } }}>
                {club.name}
              </Box>
            </Link>
          </Typography>
          {club.distanceMiles != null ? (
            <Typography variant="overline" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
              {club.distanceMiles.toFixed(1)} mi
            </Typography>
          ) : null}
        </Stack>

        {place ? (
          <Typography variant="overline" sx={{ color: "text.secondary", mt: -1 }}>
            {place}{club.postcodeArea ? ` · ${club.postcodeArea}` : ""}
          </Typography>
        ) : null}

        <StatLine
          stats={[
            { label: "Meets", value: club.meetingLabel },
            { label: "Tables", value: club.tablesAvailable },
            { label: "Members", value: club.memberCount },
            { label: "From", value: club.fromPrice },
          ]}
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

        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", mt: "auto", pt: 0.5 }}>
          {club.featuredGames.slice(0, 3).map((game) => (
            <Chip key={game} label={game} size="small" variant="outlined" />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
