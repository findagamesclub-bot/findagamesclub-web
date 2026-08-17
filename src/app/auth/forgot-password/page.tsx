import Link from "next/link";
import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AuthForm from "@/components/auth/AuthForm";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <AuthForm
        eyebrow="Password reset"
        heading="Reset your password"
        intro="Enter your email and we will send a link to set a new password."
        submitLabel="Send reset link"
        pendingLabel="Sending link"
        action={forgotPasswordAction}
        footer={
          <Typography variant="body2" color="text.secondary">
            Remembered it? <Link href="/auth/sign-in">Sign in</Link>
          </Typography>
        }
      >
        <TextField name="email" type="email" label="Email" required autoComplete="email" fullWidth />
      </AuthForm>
    </Container>
  );
}
