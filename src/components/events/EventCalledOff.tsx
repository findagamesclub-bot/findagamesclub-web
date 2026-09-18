import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import { mono, tokens } from "@/lib/tokens";

/**
 * The club called this event off.
 *
 * It opens the page, above the artwork, because everything under it reads as a
 * live event otherwise: the client cancelled one and found the hero still
 * offering the last ticket. A cancelled event stays readable on purpose, since
 * the link in somebody's confirmation email has to lead somewhere that explains
 * itself, so the page has to say so rather than quietly hiding.
 *
 * The reason is the club's own wording, shown under the same label the ticket
 * stub uses, so the two screens tell the same story in the same words.
 */
export default function EventCalledOff({
  reason, bookingReference, bookingCount = 0,
}: {
  reason: string | null;
  /** The reader's own place, if they held one. */
  bookingReference?: string | null;
  bookingCount?: number;
}) {
  // The reader's own place links out with a plain anchor around the button,
  // not `component={NextLink}`: this renders from a Server Component, and
  // passing a function into MUI from one throws at request time while tsc and
  // the build stay green.
  return (
    <Alert
      severity="error"
      icon={<EventBusyIcon fontSize="inherit" />}
      sx={{ mb: 2.5, alignItems: "flex-start" }}
      action={bookingReference ? (
        <NextLink href={bookingCount > 1 ? "/tickets" : `/tickets/${bookingReference}`}
          // `color: inherit` on the anchor, not just on the Button: the Button
          // inherits from the link, and a bare anchor is browser blue, which
          // put a blue control on a red notice.
          style={{ textDecoration: "none", color: "inherit" }}>
          <Button size="small" color="inherit">
            {bookingCount > 1 ? "Your tickets" : "Your ticket"}
          </Button>
        </NextLink>
      ) : undefined}
    >
      <AlertTitle sx={{ fontWeight: 700 }}>This event has been called off</AlertTitle>

      <Stack spacing={reason ? 1 : 0}>
        <Typography variant="body2">
          {bookingReference
            // Never "nothing to pay": somebody who paid in advance is owed it
            // back, and the stub already says REFUND DUE. This points at the
            // screen that knows rather than guessing on its behalf.
            ? "Your place was cancelled with it, so there is nothing to turn up for. Your ticket says where that leaves anything you had already paid."
            : "It is not going ahead, so tickets are closed."}
        </Typography>

        {reason ? (
          <Stack spacing={0.25}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              WHY IT WAS CALLED OFF
            </Typography>
            <Typography variant="body2">{reason}</Typography>
          </Stack>
        ) : null}
      </Stack>
    </Alert>
  );
}
