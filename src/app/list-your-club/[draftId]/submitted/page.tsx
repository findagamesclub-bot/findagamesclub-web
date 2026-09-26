import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkButton from "@/components/ui/LinkButton";
import { getCurrentProfile } from "@/services/auth.service";
import { getDraft } from "@/services/submissions.service";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Listing sent" };

/**
 * The page after Send.
 *
 * Its whole job is to answer "what happens now", so it has to read the status
 * rather than assume one. With charging on a listing lands at the payment desk
 * and nobody reads it until the money is in, and this page was telling those
 * clubs that somebody would read it in a few days and that "nothing else is
 * needed from you" while a payment was the one thing that was.
 *
 * It also names the address the email will go to, since the commonest reason
 * for "I never heard back" is that it went somewhere they do not check.
 */
export default async function ListingSubmittedPage({
  params,
}: PageProps<"/list-your-club/[draftId]/submitted">) {
  const { draftId } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/list-your-club/${draftId}/submitted`);

  const draft = await getDraft(Number(draftId));
  if (!draft) notFound();

  // Somebody who lands here on a draft they have not sent gets the builder
  // rather than a page congratulating them for work they have not done.
  if (draft.status === "draft") redirect(`/list-your-club/${draft.id}/review`);

  const owes = draft.status === "payment_pending";

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 8, md: 12 } }}>
      <Stack spacing={2.5}>
        <CheckCircleIcon sx={{ fontSize: 40, color: tokens.positive }} />

        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.12em", color: tokens.brass }}>
          {owes ? "LISTING SENT, WAITING TO BE PAID FOR" : "LISTING SENT"}
        </Typography>

        <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "2.4rem" }, lineHeight: 1.1 }}>
          {draft.club_name || "Your club"} is with us
        </Typography>

        <Typography variant="body1" sx={{ color: tokens.inkMuted }}>
          {owes
            ? "It waits with us until the first payment is in. Nothing is charged "
              + "automatically and nobody reads it before then, so the sooner it "
              + "lands the sooner you are in the directory."
            : "Somebody will read it and we will email you either way, usually "
              + "within a few days. If anything is missing we will send it back "
              + "with a note rather than turning it down."}
        </Typography>

        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {owes ? (
            <>We are emailing <strong>{viewer.email}</strong> the ways to pay. They
            are on your listing page too, whenever you need them.</>
          ) : (
            <>We will write to <strong>{viewer.email}</strong>. Nothing else is
            needed from you for now.</>
          )}
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ pt: 1, flexWrap: "wrap" }} useFlexGap>
          <LinkButton href="/account/listings" variant="contained">
            {owes ? "How to pay" : "Back to your listings"}
          </LinkButton>
          <LinkButton href="/clubs" variant="outlined">Browse clubs</LinkButton>
        </Stack>
      </Stack>
    </Container>
  );
}
