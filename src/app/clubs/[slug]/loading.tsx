import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { tokens } from "@/lib/tokens";

/**
 * Shown while a club page or any of its sections loads.
 *
 * Its presence is what makes those links feel immediate: without a loading
 * boundary Next holds the current page until the next one's data has arrived,
 * so pressing Board or Loyalty did nothing visible for a beat and people
 * pressed again.
 */
export default function ClubLoading() {
  return (
    <Container maxWidth="lg" component="main" aria-busy="true"
      sx={{
        py: { xs: 4, md: 6 },
        // Tall enough that the footer stays below the fold. A skeleton shorter
        // than the viewport leaves the page ending in mid air.
        minHeight: "100vh",
      }}>
      <ScrollToTop />

      <Stack spacing={1.5} sx={{ mb: 4 }}>
        <Skeleton variant="text" width={160} height={20} />
        <Skeleton variant="text" width="min(420px, 70%)" height={52} />
        <Skeleton variant="rounded" height={10} width={280} />
      </Stack>

      <Box sx={{ display: "grid", gap: 4,
                 gridTemplateColumns: { xs: "1fr", md: "minmax(0,2fr) minmax(280px,1fr)" } }}>
        <Stack spacing={3}>
          {[0, 1, 2].map((i) => (
            <Box key={i}>
              <Skeleton variant="text" width={130} height={22} sx={{ mb: 1.5 }} />
              <Skeleton variant="rounded" height={i === 0 ? 120 : 180}
                sx={{ borderRadius: 2 }} />
            </Box>
          ))}
        </Stack>

        <Stack spacing={2}>
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rounded" height={180}
            sx={{ borderRadius: 2, border: `1px solid ${tokens.rule}` }} />
        </Stack>
      </Box>
    </Container>
  );
}
