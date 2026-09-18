import Container from "@mui/material/Container";
import AuthForm from "@/components/auth/AuthForm";
import PasswordFields from "@/components/auth/PasswordFields";
import { resetPasswordAction } from "../actions";
import { getCurrentUserEmail } from "@/services/auth.service";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The reset link signs them in, so the address is here to measure against.
  // Without it the meter read Good on a password the server then refused for
  // being the account's own email address.
  const email = await getCurrentUserEmail();

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <AuthForm
        eyebrow="Password reset"
        heading="Choose a new password"
        submitLabel="Save password"
        pendingLabel="Saving"
        action={resetPasswordAction}
      >
        <PasswordFields label="New password" email={email} />
      </AuthForm>
    </Container>
  );
}
