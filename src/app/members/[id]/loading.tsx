import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ScrollToTop from "@/components/ui/ScrollToTop";

/** While a member's profile fetches its clubs and the reader's record. */
export default function MemberLoading() {
  return (
    <Container maxWidth="md" component="main" aria-busy="true"
      sx={{ py: { xs: 4, md: 6 }, minHeight: "100vh" }}>
      <ScrollToTop />
      <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", mb: 4 }}>
        <Skeleton variant="circular" width={72} height={72} />
        <Stack spacing={0.75} sx={{ flex: 1 }}>
          <Skeleton variant="text" width="min(280px, 60%)" height={40} />
          <Skeleton variant="text" width={180} height={20} />
        </Stack>
      </Stack>
      <Stack spacing={3}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: 2 }} />
        ))}
      </Stack>
    </Container>
  );
}
