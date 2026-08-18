import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import CasinoIcon from "@mui/icons-material/Casino";
import type { SvgIconComponent } from "@mui/icons-material";
import { mono, tokens } from "@/lib/tokens";

type Props = { clubs: number; towns: number; games: number };

/**
 * What's in the directory, as one connected strip rather than three loose
 * pills — the same profile block the club cards use, so the hero and the
 * listing below it speak the same language.
 */
export default function DirectoryStats({ clubs, towns, games }: Props) {
  const stats: { icon: SvgIconComponent; value: number; label: string }[] = [
    { icon: GroupsIcon, value: clubs, label: clubs === 1 ? "Club" : "Clubs" },
    { icon: LocationCityIcon, value: towns, label: towns === 1 ? "Town" : "Towns" },
    { icon: CasinoIcon, value: games, label: "Games" },
  ];

  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        maxWidth: 440,
        borderRadius: 1,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.16)",
        backgroundColor: "rgba(255,255,255,0.045)",
      }}
    >
      {stats.map((stat, i) => (
        <Box
          key={stat.label}
          sx={{
            px: { xs: 1.5, sm: 2 },
            py: 1.5,
            // Brass hairlines between cells, none on the outer edge.
            borderLeft: i === 0 ? "none" : `1px solid ${tokens.brassOnDark}33`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.875, mb: 0.25 }}>
            <stat.icon aria-hidden sx={{ fontSize: 20, color: tokens.brassOnDark, flexShrink: 0 }} />
            <Typography
              component="dd"
              sx={{
                m: 0,
                fontFamily: mono,
                fontVariantNumeric: "tabular-nums",
                fontSize: { xs: "1.35rem", sm: "1.6rem" },
                fontWeight: 600,
                lineHeight: 1,
                color: "#FFFFFF",
              }}
            >
              {stat.value}
            </Typography>
          </Box>
          <Typography component="dt" variant="overline" sx={{ color: "#9DB0C7", display: "block" }}>
            {stat.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
