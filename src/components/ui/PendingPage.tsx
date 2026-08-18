import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinkButton from "./LinkButton";
import { tokens } from "@/lib/tokens";

/**
 * Placeholder for pages whose content has to come from the client. Says plainly
 * what is missing and who to contact, rather than inventing legal text.
 */
export default function PendingPage({
  eyebrow, title, description,
}: { eyebrow: string; title: string; description: string }) {
  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 8, md: 12 } }}>
      <Stack spacing={2}>
        <Typography variant="overline" sx={{ color: tokens.brass }}>{eyebrow}</Typography>
        <Typography variant="h1" sx={{ fontSize: "2.45rem" }}>{title}</Typography>
        <Typography variant="body1" color="text.secondary">{description}</Typography>
        <Typography variant="body2" color="text.secondary">
          In the meantime, email{" "}
          <a href="mailto:hello@findagamesclub.co.uk" style={{ color: tokens.brand }}>hello@findagamesclub.co.uk</a>
          {" "}and we will help.
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
          <LinkButton href="/clubs" variant="outlined">Browse clubs</LinkButton>
        </Stack>
      </Stack>
    </Container>
  );
}
