import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import SearchIcon from "@mui/icons-material/Search";
import { tokens } from "@/lib/tokens";

/** A club, event or member that is not there. Sends people somewhere useful. */
export default function NotFound() {
  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 8, md: 12 } }}>
      <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, lineHeight: 1.15 }}>
        Not found
      </Typography>
      <Box sx={{ width: 76, height: 4, bgcolor: tokens.brass, borderRadius: 2, mt: 1.75, mb: 2.5 }} />

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520 }}>
        That page is not here. The club may have been removed, or the link may have a typo
        in it.
      </Typography>

      <Stack direction="row" spacing={1.5} sx={{ mt: 3.5, flexWrap: "wrap" }} useFlexGap>
        {/* Wrapped, not `component={NextLink}`: this is a Server Component, and
            passing a component function into MUI's client Button throws
            "Functions cannot be passed directly to Client Components" during
            hydration. The server rendered a correct 404; the client then blew
            up and the error boundary caught it. */}
        <NextLink href="/clubs" style={{ textDecoration: "none" }}>
          <Button variant="contained" startIcon={<SearchIcon />}>
            Find a club
          </Button>
        </NextLink>
      </Stack>
    </Container>
  );
}
