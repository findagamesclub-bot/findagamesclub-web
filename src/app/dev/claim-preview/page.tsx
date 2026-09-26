import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClaimForm from "@/components/clubs/ClaimForm";
import { tokens } from "@/lib/tokens";

/**
 * Local-only view of the claim form.
 *
 * The real page 404s unless an admin has opened that club to claims, so the
 * form is unreachable to the overflow sweep and to anybody looking at layout.
 * Its three states read very differently: a long box with a counter, a short
 * answer with a way out, and a short answer with somebody's reason in it.
 */
export default function ClaimPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const states: { heading: string; existing: Parameters<typeof ClaimForm>[0]["existing"] }[] = [
    { heading: "Nobody has claimed it", existing: null },
    { heading: "Theirs is waiting", existing: { id: 1, status: "open", note: "" } },
    {
      heading: "Turned down, with a reason",
      existing: {
        id: 2, status: "declined",
        note: "We could not match the email address to anything the club has published, "
          + "and the committee page names somebody else as secretary. Get in touch from "
          + "the club's own address and we will look again.",
      },
    },
  ];

  return (
    <Container maxWidth="sm" component="main" sx={{ py: 4 }}>
      <Typography variant="h1" sx={{ fontSize: "1.6rem", mb: 3 }}>Claim form</Typography>
      <Stack spacing={5}>
        {states.map((state) => (
          <Stack key={state.heading} spacing={1.5}>
            <Typography sx={{ fontFamily: "monospace", fontSize: "0.72rem",
                              color: tokens.inkMuted, textTransform: "uppercase" }}>
              {state.heading}
            </Typography>
            <ClaimForm slug="leeds-meeple-society" clubName="Leeds Meeple Society"
              existing={state.existing} />
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}
