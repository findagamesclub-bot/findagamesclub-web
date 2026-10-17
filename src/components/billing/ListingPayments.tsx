import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import type { PaymentRow } from "@/repositories/billing.repository";
import { methodLabel } from "@/utils/listing-billing";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * What this club has paid for its listing.
 *
 * Lifted out of the billing page when the featured half grew, so the page goes
 * back to reading like a table of contents. Presentation only: what counts as
 * paid, and whether charging is even on, are both decided above it.
 */
export default function ListingPayments({
  payments,
}: {
  payments: PaymentRow[];
}) {
  if (payments.length === 0) {
    return (
      <EmptyState
        title="Nothing recorded yet"
        description="Payments appear here once we have written them down. If you have sent one and it is not here, get in touch."
      />
    );
  }

  return (
    <Stack spacing={2}>
      {payments.map((payment) => (
        <Stack key={payment.id} spacing={0.4}
          sx={{ pb: 1.5, borderBottom: `1px solid ${tokens.rule}`,
                "&:last-of-type": { borderBottom: 0, pb: 0 } }}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
            <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700 }}>
              {formatPence(payment.amount_pence, payment.currency)}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                              color: tokens.inkMuted }}>
              {[
                shortDate(payment.paid_at.slice(0, 10)),
                methodLabel(payment.method),
                payment.reference,
              ].filter(Boolean).join(" · ")}
            </Typography>
          </Stack>
          {payment.period_start && payment.period_end ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {`Covers ${shortDate(payment.period_start.slice(0, 10))} to `
                + `${shortDate(payment.period_end.slice(0, 10))}.`}
            </Typography>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
