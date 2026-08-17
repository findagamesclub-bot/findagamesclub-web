import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import StatLine from "@/components/ui/StatLine";
import { tokens } from "@/lib/tokens";
import type { ClubDetail } from "@/types/clubDetail";

export default function ClubHeader({ club }: { club: ClubDetail }) {
  const place = [club.neighbourhood, club.city].filter(Boolean).join(" · ");

  return (
    <Stack spacing={2} component="header">
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="overline" sx={{ color: "text.secondary" }}>
          {place}{club.venue.district ? ` · ${club.venue.district}` : ""}
        </Typography>
        {club.isFeatured ? (
          <Chip label="Featured" size="small" sx={{ bgcolor: tokens.brassSoft, color: "#5c4310", fontWeight: 600 }} />
        ) : null}
      </Stack>

      <Typography variant="h1">{club.name}</Typography>

      {club.summary ? (
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 680 }}>
          {club.summary}
        </Typography>
      ) : null}

      {club.announcement ? <Alert severity="info">{club.announcement}</Alert> : null}

      <StatLine
        stats={[
          { label: "Meets", value: club.meetingLabel },
          { label: "Tables", value: club.tablesAvailable },
          { label: "Members", value: club.memberCount },
          { label: "From", value: club.fromPrice },
        ]}
      />
    </Stack>
  );
}
