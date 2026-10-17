import Box from "@mui/material/Box";
import ScrollBox from "@/components/ui/ScrollBox";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { MembershipPayment } from "@/types/payment";

/**
 * The member's copy of the club's ledger.
 *
 * Clubs take cash at the door, so these are records an owner typed in rather
 * than card charges. A member could previously only take the club's word for
 * it, and then only for half of it: the row showed the period a payment
 * covered **or** the day it was written down, whichever existed, and never
 * the note the club left beside it.
 *
 * The client asked for all three, and they answer different questions. What
 * it bought is the thing a member checks; when it was recorded is what they
 * compare against the day they actually handed the money over; the note is
 * where "paid in cash, £5 short, will settle next week" lives.
 *
 * It scrolls once the history is long, and that overrides an earlier call.
 *
 * This shipped with no inner scroll, on rule 9's reasoning that a scrolling box
 * inside a disclosure inside a card is a nested scroll. That holds for a dozen
 * rows and breaks at a hundred: these cards sit in a two-column grid, so one
 * member who has paid monthly for eight years makes a card thousands of pixels
 * tall, stretches its whole grid row, and buries the Withdraw button and every
 * card below it. A contained scroll is the lesser of the two.
 *
 * Only past `SCROLL_AFTER`, so the ordinary history still has no scrollbar and
 * rule 9 applies everywhere it was right. The cap is in rows rather than a flat
 * height because a row with a note from the club is twice the height of one
 * without, so a fixed pixel box would cut one history mid-note and leave
 * another half empty.
 */

/** Rows to show before the box starts scrolling. */
const SCROLL_AFTER = 5;
/** Roughly a row without a note. The cap is this times the rows shown. */
const ROW_HEIGHT = 64;

export default function PaymentRows({ payments }: { payments: MembershipPayment[] }) {
  const scrolls = payments.length > SCROLL_AFTER;

  return (
    <ScrollBox scrolls={scrolls} cap={SCROLL_AFTER * ROW_HEIGHT}
      label={`${payments.length} payments`}
      // Says there is more below without a label that would be wrong the
      // moment somebody scrolls.
      sx={scrolls ? { borderBottom: `1px solid ${tokens.rule}` } : undefined}>
      {payments.map((payment) => {
        const when = [
          payment.periodEnd ? `Covers to ${shortDate(payment.periodEnd)}` : null,
          payment.recordedAt ? `Recorded ${shortDate(payment.recordedAt)}` : null,
          // The club can put a payment right since 0195. A member reading the
          // same ledger has to be able to see that one was changed, or the
          // correction is the club quietly editing its own record of what the
          // member handed over.
          payment.editedAt ? `Corrected ${shortDate(payment.editedAt)}` : null,
        ].filter(Boolean).join(" · ");

        return (
          <Stack key={payment.id} direction="row" spacing={1.5}
            sx={{ py: 1, alignItems: "baseline",
                  "&:not(:last-of-type)": { borderBottom: `1px solid ${tokens.rule}` } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {payment.tierLabel}
                {payment.billingOptionLabel ? ` · ${payment.billingOptionLabel}` : ""}
              </Typography>

              {when ? (
                <Typography sx={{ fontSize: "0.76rem", color: tokens.inkMuted }}>
                  {when}
                </Typography>
              ) : null}

              {/* The club's own words. Attributed, because an unattributed
                  line on somebody's payment record reads as the site's. */}
              {payment.note ? (
                <Typography sx={{ fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
                                  color: tokens.inkMuted, mt: 0.25,
                                  whiteSpace: "pre-wrap" }}>
                  <Box component="span" sx={{ fontFamily: mono, fontSize: "0.64rem",
                                              letterSpacing: "0.06em", mr: 0.75 }}>
                    THE CLUB WROTE
                  </Box>
                  {payment.note}
                </Typography>
              ) : null}
            </Box>

            <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                              flexShrink: 0 }}>
              {payment.price}
            </Typography>
          </Stack>
        );
      })}
    </ScrollBox>
  );
}
