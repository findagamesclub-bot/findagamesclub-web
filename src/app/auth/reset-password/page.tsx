import Container from "@mui/material/Container";
import TextField from "@mui/material/TextField";
import AuthForm from "@/components/auth/AuthForm";
import { resetPasswordAction } from "../actions";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <AuthForm
        eyebrow="Password reset"
        heading="Choose a new password"
        submitLabel="Save password"
        pendingLabel="Saving"
        action={resetPasswordAction}
      >
        <TextField name="password" type="password" label="New password" required
          autoComplete="new-password" fullWidth />
        <TextField name="confirm" type="password" label="Confirm password" required
          autoComplete="new-password" fullWidth />
      </AuthForm>
    </Container>
  );
}
