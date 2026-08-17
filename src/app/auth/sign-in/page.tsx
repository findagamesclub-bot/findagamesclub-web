import Link from "next/link";
import Alert from "@mui/material/Alert";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AuthForm from "@/components/auth/AuthForm";
import { signInAction } from "../actions";

export const metadata = { title: "Sign in" };

const MESSAGES: Record<string, string> = {
  "invalid-link": "That link was not valid. Request a new one below.",
  "expired-link": "That link has expired. Request a new one below.",
};

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  const params = await searchParams;
  const key = Array.isArray(params.error) ? params.error[0] : params.error;
  const message = key ? MESSAGES[key] : undefined;

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <Stack spacing={2}>
        {message ? <Alert severity="warning" sx={{ maxWidth: 460, mx: "auto", width: "100%" }}>{message}</Alert> : null}
        <AuthForm
          eyebrow="Welcome back"
          heading="Sign in"
          submitLabel="Sign in"
        pendingLabel="Signing in"
          action={signInAction}
          footer={
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                <Link href="/auth/forgot-password">Forgotten your password?</Link>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No account yet? <Link href="/auth/sign-up">Create one</Link>
              </Typography>
            </Stack>
          }
        >
          <TextField name="email" type="email" label="Email" required autoComplete="email" fullWidth />
          <TextField name="password" type="password" label="Password" required autoComplete="current-password" fullWidth />
        </AuthForm>
      </Stack>
    </Container>
  );
}
