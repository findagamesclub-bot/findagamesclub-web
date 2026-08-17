import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubGrid from "@/components/clubs/ClubGrid";
import LinkButton from "@/components/ui/LinkButton";
import { listClubs } from "@/services/clubs.service";
import { tokens } from "@/lib/tokens";

export default async function HomePage() {
  const { clubs, total } = await listClubs({ sort: "relevance" });

  return (
    <Box component="main">
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
          <Typography variant="overline" sx={{ color: tokens.brass }}>
            {total} clubs across the UK
          </Typography>
          <Typography variant="h1">Find a club you will actually turn up to</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 620 }}>
            Every listing shows the same four things up front: the night they meet,
            whether you can book a table, how big the club is, and what it costs.
            No ringing round, no out-of-date Facebook groups.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
            <LinkButton href="/clubs" variant="contained" size="large">
              Browse the directory
            </LinkButton>
            <LinkButton href="/auth/sign-up" variant="outlined" size="large">
              Create an account
            </LinkButton>
          </Stack>
        </Stack>
      </Container>

      <Box sx={{ borderTop: `1px solid ${tokens.rule}`, background: tokens.paper }}>
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
          <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 3 }}>
            <Typography variant="h2" sx={{ fontSize: "1.75rem" }}>Featured clubs</Typography>
            <LinkButton href="/clubs" variant="text">See all {total}</LinkButton>
          </Stack>
          <ClubGrid clubs={clubs.slice(0, 6)} />
        </Container>
      </Box>
    </Box>
  );
}
