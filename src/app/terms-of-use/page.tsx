import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PendingPage from "@/components/ui/PendingPage";
import Markdown from "@/components/ui/Markdown";
import { getSiteSettings } from "@/services/siteSettings.service";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Terms of use" };

/**
 * Whatever an admin has written, or the placeholder until they have.
 *
 * Legacy seeds this with the literal words "this is sample text", which is
 * worse on a live page than saying plainly that it is coming. So the mechanism
 * is legacy's and the words are the client's, and the page says which state it
 * is in rather than showing an empty heading.
 */
export default async function TermsPage() {
  const settings = await getSiteSettings();

  if (!settings.termsMd.trim()) {
    return (
      <PendingPage eyebrow="Legal" title="Terms of use"
        description="These terms are being prepared and will be published before the site goes live." />
    );
  }

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 6, md: 9 } }}>
      <Stack spacing={2}>
        <Typography variant="overline" sx={{ color: tokens.brass }}>Legal</Typography>
        <Markdown source={settings.termsMd} />
      </Stack>
    </Container>
  );
}
