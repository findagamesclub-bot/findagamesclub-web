import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PendingPage from "@/components/ui/PendingPage";
import Markdown from "@/components/ui/Markdown";
import { getSiteSettings } from "@/services/siteSettings.service";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  const settings = await getSiteSettings();

  if (!settings.privacyMd.trim()) {
    return (
      <PendingPage eyebrow="Legal" title="Privacy policy"
        description="The privacy policy is being prepared and will be published before the site goes live." />
    );
  }

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 6, md: 9 } }}>
      <Stack spacing={2}>
        <Typography variant="overline" sx={{ color: tokens.brass }}>Legal</Typography>
        <Markdown source={settings.privacyMd} />
      </Stack>
    </Container>
  );
}
