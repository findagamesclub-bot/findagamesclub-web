import Container from "@mui/material/Container";
import AuthForm from "@/components/auth/AuthForm";
import PasswordFields from "@/components/auth/PasswordFields";
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
        <PasswordFields label="New password" />
      </AuthForm>
    </Container>
  );
}
