import Container from "@mui/material/Container";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/auth/check-email">) {
  const params = await searchParams;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <EmptyState
        title="Check your email"
        description={
          to
            ? `We sent a confirmation link to ${to}. Open it to finish setting up your account.`
            : "We sent you a confirmation link. Open it to finish setting up your account."
        }
        action={{ label: "Back to the directory", href: "/clubs" }}
      />
    </Container>
  );
}
