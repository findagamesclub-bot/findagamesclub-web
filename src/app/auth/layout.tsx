import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BrandMark from "@/components/layout/BrandMark";
import { headerHeight, mono, tokens } from "@/lib/tokens";

/**
 * Split shell for every auth screen.
 *
 * On its own the form is a small card adrift in a very large empty page. The
 * ink panel gives it a side to sit against and carries the brand on the two
 * screens where someone is deciding whether to trust us with an email address.
 */
export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 5fr) minmax(0, 6fr)" },
        minHeight: { md: `calc(100vh - ${headerHeight.md}px)` },
        // The footer keeps a 12-unit top margin to stand off page content. This
        // panel is full-bleed and meets it directly, so that gap reads as a
        // pale stripe between two dark blocks — cancel it while stacked side by
        // side, and leave it alone on mobile where the panel is hidden.
        mb: { md: -12 },
      }}
    >
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          gap: 3,
          px: { md: 6, lg: 9 },
          py: 8,
          backgroundColor: tokens.ink,
          color: "#FFFFFF",
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px)`,
          borderRight: `2px solid ${tokens.brassOnDark}`,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <BrandMark size={58} onDark />
          <Typography
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.018em",
            }}
          >
            FindAGamesClub
          </Typography>
        </Stack>

        <Typography variant="h2" sx={{ color: "#FFFFFF", fontSize: { md: "2.3rem", lg: "2.7rem" }, maxWidth: 460 }}>
          Tabletop and wargaming clubs across the UK
        </Typography>

        <Typography sx={{ color: "#B9C9DD", maxWidth: 420, lineHeight: 1.65 }}>
          Find one near you, see the night they meet, and turn up.
        </Typography>

        <Typography
          sx={{
            fontFamily: mono,
            fontSize: "0.83rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: tokens.brassOnDark,
            mt: 1,
          }}
        >
          Free to join
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
        <Box sx={{ width: "100%" }}>{children}</Box>
      </Box>
    </Box>
  );
}
