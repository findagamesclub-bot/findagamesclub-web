import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkButton from "@/components/ui/LinkButton";
import { getCurrentProfile } from "@/services/auth.service";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "All set" };

/**
 * Landing page after a confirmation link is opened.
 *
 * The link used to drop people straight onto the directory, signed in with no
 * explanation — which reads as though the click did nothing. Saying plainly
 * that the address is confirmed, and that they're now signed in, closes the
 * loop the email opened.
 */
export default async function EmailConfirmedPage({ searchParams }: PageProps<"/auth/confirmed">) {
  const params = await searchParams;
  const done = Array.isArray(params.done) ? params.done[0] : params.done;
  const isReset = done === "password";

  const profile = await getCurrentProfile();
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 56,
                height: 56,
                borderRadius: "50%",
                backgroundColor: "#E3F1E9",
              }}
            >
              <CheckCircleIcon aria-hidden sx={{ fontSize: 30, color: tokens.positive }} />
            </Box>

            <Stack spacing={0.75}>
              <Typography variant="overline" color="text.secondary">
                {isReset ? "Password updated" : "Email confirmed"}
              </Typography>
              <Typography variant="h2" sx={{ fontSize: "1.95rem" }}>
                {firstName ? `You're all set, ${firstName}` : "You're all set"}
              </Typography>
            </Stack>

            <Typography variant="body1" color="text.secondary">
              {isReset
                ? "Your new password is saved and you are signed in. We have emailed you to confirm the change."
                : profile?.email
                  ? `${profile.email} is confirmed and you are signed in.`
                  : "Your email address is confirmed and you are signed in."}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Search by town, by what a club plays, or by how far you will travel. Club
              pages show when they meet, whether tables can be booked, and what it costs.
            </Typography>

            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", pt: 0.5 }}>
              <LinkButton href="/clubs" variant="contained" size="large">Browse the directory</LinkButton>
              <LinkButton href="/" variant="outlined" size="large">Go to the homepage</LinkButton>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
