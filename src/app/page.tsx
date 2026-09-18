import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubGrid from "@/components/clubs/ClubGrid";
import HeroFan from "@/components/home/HeroFan";
import LinkButton from "@/components/ui/LinkButton";
import { FOOTER_GAP } from "@/components/layout/SiteFooter";
import { listClubs } from "@/services/clubs.service";
import { getCurrentProfile } from "@/services/auth.service";
import { mono, tokens } from "@/lib/tokens";

export default async function HomePage() {
  const [{ clubs, total }, profile] = await Promise.all([
    listClubs({ sort: "relevance" }),
    getCurrentProfile(),
  ]);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <Box component="main">
      <Box
        sx={{
          position: "relative",
          backgroundColor: tokens.ink,
          color: "#FFFFFF",
          overflow: "hidden",
          // Same 44px grid the artwork fallback uses, so the hero and the cards
          // below read as one surface.
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 44px)`,
          borderBottom: `2px solid ${tokens.brassOnDark}`,
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 4, md: 6 }}
            // Stretch while stacked so the copy fills the column; centre only
            // once the deck sits beside it.
            sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}
          >
            <Stack spacing={2.5} sx={{ maxWidth: 600 }}>
              <Typography
                sx={{
                  fontFamily: mono,
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: tokens.brassOnDark,
                }}
              >
                {firstName ? `Welcome back, ${firstName}` : `${total} clubs across the UK`}
              </Typography>

              <Typography variant="h1" sx={{ color: "#FFFFFF" }}>
                Find a club you will actually turn up to
              </Typography>

              <Typography sx={{ color: "#B9C9DD", maxWidth: 540, lineHeight: 1.65 }}>
                Every listing shows the same four things up front: the night they meet,
                whether you can book a table, how big the club is, and what it costs.
                No ringing round, no out-of-date Facebook groups.
              </Typography>

              <Stack direction="row" spacing={1.5} useFlexGap sx={{ pt: 1, flexWrap: "wrap" }}>
                <LinkButton href="/clubs" variant="contained" size="large">
                  Browse the directory
                </LinkButton>
                {/* Offering "Create an account" to someone already signed in is noise. */}
                {profile ? null : (
                  <LinkButton
                    href="/auth/sign-up"
                    variant="outlined"
                    size="large"
                    sx={{
                      color: "#FFFFFF",
                      borderColor: "rgba(255,255,255,0.4)",
                      "&:hover": { borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.08)" },
                    }}
                  >
                    Create an account
                  </LinkButton>
                )}
              </Stack>
            </Stack>

            <HeroFan clubs={clubs} />
          </Stack>
        </Container>
      </Box>

      <Box sx={{ background: tokens.paper }}>
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
          <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 3 }}>
            <Typography variant="h2" sx={{ fontSize: "1.95rem" }}>Featured clubs</Typography>
            <LinkButton href="/clubs" variant="text">See all {total}</LinkButton>
          </Stack>
          <ClubGrid clubs={clubs.slice(0, 6)} />
        </Container>
      </Box>

      {/* The other half of the audience. Everything above this is written for
          somebody looking for a club; this is the one line on the page for
          somebody who runs one, and without it the listing flow had no door on
          the front of the site at all. Last, not first, because the people
          looking for a club outnumber the people running one. */}
      <Box sx={{ backgroundColor: tokens.ink, color: "#FFFFFF",
                 // Flush with the footer. This band already ends the page on a
                 // dark ground, so the footer's usual breathing room above it
                 // would leave a pale strip between two dark blocks.
                 mb: { xs: -FOOTER_GAP.xs, md: -FOOTER_GAP.md } }}>
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
          <Stack direction={{ xs: "column", md: "row" }}
            spacing={{ xs: 2.5, md: 5 }}
            sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
            <Stack spacing={1.25} sx={{ maxWidth: 560 }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", fontWeight: 700,
                                letterSpacing: "0.14em", color: tokens.brassOnDark }}>
                RUN A CLUB?
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: "1.7rem", md: "2rem" },
                                             color: "#FFFFFF" }}>
                Put yours in the directory
              </Typography>
              <Typography variant="body1" sx={{ color: "#B9C9DD" }}>
                Free to list. Take table bookings, run events and sell tickets,
                keep your members in one place, and stop halfway if the night
                gets busy.
              </Typography>
            </Stack>

            <LinkButton href="/list-your-club" variant="contained" size="large"
              sx={{ alignSelf: { xs: "flex-start", md: "center" }, flexShrink: 0,
                    backgroundColor: tokens.brass, color: "#FFFFFF",
                    "&:hover": { backgroundColor: "#9C711F" } }}>
              List your club
            </LinkButton>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
