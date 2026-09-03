import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ScrollToTop from "@/components/ui/ScrollToTop";

/** While the events directory fetches. Same reasoning as the club boundary. */
export default function EventsLoading() {
  return (
    <Container maxWidth="lg" component="main" aria-busy="true"
      sx={{ py: { xs: 4, md: 6 }, minHeight: "100vh" }}>
      <ScrollToTop />
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        <Skeleton variant="text" width={220} height={48} />
        <Skeleton variant="text" width="min(520px, 80%)" height={24} />
      </Stack>
      <Skeleton variant="rounded" height={96} sx={{ borderRadius: 2, mb: 3 }} />
      <Box sx={{ display: "grid", gap: 2.5,
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))",
                   lg: "repeat(3, minmax(0, 1fr))",
                 } }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rounded" height={360} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
    </Container>
  );
}
