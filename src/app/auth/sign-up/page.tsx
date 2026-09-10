import Link from "next/link";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import AuthForm from "@/components/auth/AuthForm";
import AuthField from "@/components/auth/AuthField";
import PasswordFields from "@/components/auth/PasswordFields";
import { signUpAction } from "../actions";

export const metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: PageProps<"/auth/sign-up">) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  // Somebody sent here by an invitation is not browsing. Saying why they are
  // filling this in is the difference between finishing it and leaving.
  const invited = Boolean(next?.startsWith("/team/invites/"));

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <AuthForm
        eyebrow={invited ? "One step first" : "Join"}
        heading="Create an account"
        intro={invited
          ? "Make an account with the address the invitation was sent to, and it will be waiting when you confirm."
          : "You need an account to join a club, book a table or enter an event."}
        submitLabel="Create account"
        pendingLabel="Creating account"
        action={signUpAction}
        footer={
          <Typography variant="body2" color="text.secondary">
            Already have one?{" "}
            <Link href={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in"}>
              Sign in
            </Link>
          </Typography>
        }
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <AuthField name="fullName" label="Your name" required autoComplete="name" fullWidth />
        <AuthField name="email" type="email" label="Email" required autoComplete="email" fullWidth />
        <PasswordFields />
      </AuthForm>
    </Container>
  );
}
