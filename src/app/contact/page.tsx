import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MailIcon from "@mui/icons-material/AlternateEmail";
import LinkButton from "@/components/ui/LinkButton";
import { getSiteSettings } from "@/services/siteSettings.service";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Contact" };

/**
 * The address an admin set, rather than one hardcoded in three places.
 *
 * Legacy has exactly this: one `contactEmail` in its settings file, shown on
 * the contact page. No form, which is the right call for now, because a form
 * that files a message nobody has built an inbox for is worse than an address
 * that reaches a person.
 */
export default async function ContactPage() {
  const { contactEmail } = await getSiteSettings();
  const address = contactEmail.trim() || "hello@findagamesclub.co.uk";

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 8, md: 12 } }}>
      <Stack spacing={2}>
        <Typography variant="overline" sx={{ color: tokens.brass }}>Get in touch</Typography>
        <Typography variant="h1" sx={{ fontSize: "2.45rem" }}>Contact</Typography>
        <Typography variant="body1" color="text.secondary">
          Listing a club, a question about a booking, or something that looks wrong on the
          site. Email us and a person will read it.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center", pt: 0.5 }}>
          <MailIcon sx={{ fontSize: 18, color: tokens.brass }} />
          <Typography component="a" href={`mailto:${address}`} variant="body1"
            sx={{ color: tokens.brand, fontWeight: 600 }}>
            {address}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ pt: 1, flexWrap: "wrap" }} useFlexGap>
          <LinkButton href="/list-your-club" variant="contained">List your club</LinkButton>
          <LinkButton href="/clubs" variant="outlined">Browse clubs</LinkButton>
        </Stack>
      </Stack>
    </Container>
  );
}
