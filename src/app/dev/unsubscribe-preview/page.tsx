import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import UnsubscribePanel from "@/components/account/UnsubscribePanel";
import { FAMILY_META } from "@/utils/notification-families";
import { tokens } from "@/lib/tokens";

/**
 * Local-only view of the unsubscribe page, in all three states.
 *
 * The real page needs a token out of somebody's email, so the sweep cannot
 * reach the state that matters. The three read very differently: a question
 * with a button, an answer with none, and a dead end that still offers a way
 * on.
 */
export default function UnsubscribePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const states = [
    { heading: "The link works", family: "bookings" as const, alreadyOff: false },
    { heading: "Already off", family: "membership" as const, alreadyOff: true },
    { heading: "We do not know that link", family: null, alreadyOff: false },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Stack spacing={5}>
        {states.map((state) => (
          <Stack key={state.heading} spacing={1.5}>
            <Typography sx={{ fontSize: "0.8rem", color: tokens.inkMuted }}>
              {state.heading}
            </Typography>
            <UnsubscribePanel
              token="preview"
              label={state.family ? FAMILY_META[state.family].label : null}
              detail={state.family ? FAMILY_META[state.family].detail : null}
              alreadyOff={state.alreadyOff}
            />
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}
