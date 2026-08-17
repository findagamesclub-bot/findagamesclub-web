import Link from "next/link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";

/**
 * Deep ink footer. The page sits on a pale surface, so a white footer read as
 * lighter than the body and floated instead of closing the page. Going darker
 * anchors it and makes the boundary unmistakable.
 *
 * Terms, privacy and contact point at holding pages — that copy has to come
 * from the client rather than be invented here.
 */

const LINK = { color: "#C2D9F2", textDecoration: "none", fontSize: "0.9rem" };

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack spacing={1.25} sx={{ minWidth: 132 }}>
      <Typography
        variant="overline"
        sx={{ color: tokens.brassOnDark, letterSpacing: "0.14em" }}
      >
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export default function SiteFooter() {
  return (
    <Box
      component="footer"
      sx={{
        mt: { xs: 8, md: 12 },
        backgroundColor: tokens.ink,
        color: "#E8EFF8",
        // A thin brass rule across the top: the boundary reads as intentional
        // rather than as a shadow or a gap.
        borderTop: `2px solid ${tokens.brassOnDark}`,
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 4, md: 8 }}
          sx={{ justifyContent: "space-between" }}
        >
          <Stack spacing={1.25} sx={{ maxWidth: 320 }}>
            <Typography
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: "0.95rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#FFFFFF",
              }}
            >
              FindAGamesClub
            </Typography>
            <Typography variant="body2" sx={{ color: "#9DB0C7", lineHeight: 1.6 }}>
              Tabletop and wargaming clubs across the UK. Find one near you, see
              when they meet, and book a table.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={{ xs: 4, sm: 6 }} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Column title="Browse">
              <Link href="/clubs" style={LINK}>Club directory</Link>
            </Column>
            <Column title="Account">
              <Link href="/auth/sign-in" style={LINK}>Sign in</Link>
              <Link href="/auth/sign-up" style={LINK}>Create an account</Link>
            </Column>
            <Column title="About">
              <Link href="/contact" style={LINK}>Contact</Link>
              <Link href="/terms-of-use" style={LINK}>Terms of use</Link>
              <Link href="/privacy-policy" style={LINK}>Privacy policy</Link>
            </Column>
          </Stack>
        </Stack>

        <Typography
          variant="body2"
          sx={{
            mt: { xs: 4, md: 6 },
            pt: 3,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            fontSize: "0.8rem",
            color: "#7C8DA6",
          }}
        >
          © {new Date().getFullYear()} FindAGamesClub
        </Typography>
      </Container>
    </Box>
  );
}
