import Link from "next/link";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AuthForm from "@/components/auth/AuthForm";
import { signUpAction } from "../actions";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <AuthForm
        eyebrow="Join"
        heading="Create an account"
        intro="You need an account to join a club, book a table or enter an event."
        submitLabel="Create account"
        pendingLabel="Creating account"
        action={signUpAction}
        footer={
          <Typography variant="body2" color="text.secondary">
            Already have one? <Link href="/auth/sign-in">Sign in</Link>
          </Typography>
        }
      >
        <TextField name="fullName" label="Your name" required autoComplete="name" fullWidth />
        <TextField name="email" type="email" label="Email" required autoComplete="email" fullWidth />
        <TextField
          name="password" type="password" label="Password" required
          autoComplete="new-password" fullWidth
        />
      </AuthForm>
    </Container>
  );
}
