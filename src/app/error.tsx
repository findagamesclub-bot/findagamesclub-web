"use client";

import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import RefreshIcon from "@mui/icons-material/Refresh";
import { tokens } from "@/lib/tokens";

/**
 * What a reader sees when something fails.
 *
 * Most failures here are a moment's trouble reaching the database, and the
 * honest response is "try again" rather than an apology or a stack trace. The
 * digest is shown because it is the only thing that makes a report actionable;
 * the message itself is not, since it can carry query internals.
 */
export default function ErrorPage({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page failed to render", error);
  }, [error]);

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 8, md: 12 } }}>
      <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, lineHeight: 1.15 }}>
        That did not load
      </Typography>
      <Box sx={{ width: 76, height: 4, bgcolor: tokens.brass, borderRadius: 2, mt: 1.75, mb: 2.5 }} />

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520 }}>
        Something went wrong fetching this page. It is usually a moment&rsquo;s trouble rather
        than anything you did, so trying again is worth a go.
      </Typography>

      <Stack direction="row" spacing={1.5} sx={{ mt: 3.5, flexWrap: "wrap" }} useFlexGap>
        <Button variant="contained" onClick={reset} startIcon={<RefreshIcon />}>
          Try again
        </Button>
        <Button component={NextLink} href="/clubs" variant="outlined"
          sx={{ color: tokens.ink, borderColor: tokens.rule }}>
          Back to the directory
        </Button>
      </Stack>

      {error.digest ? (
        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                          color: tokens.inkMuted, mt: 4 }}>
          REFERENCE {error.digest}
        </Typography>
      ) : null}
    </Container>
  );
}
