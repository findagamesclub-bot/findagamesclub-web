import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import { refundTag } from "@/utils/refund-status";
import { methodLabel } from "@/utils/listing-billing";
import { PAYMENT_KIND_LABELS, type ClubPayment } from "@/utils/club-payments";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * What this club has paid us, for anything.
 *
 * It read `listing_payments` and nothing else, so a club that has never been
 * charged for its listing and has paid for three homepage weeks was told
 * "Nothing recorded yet" directly under a slot list saying PAID · BANK
 * TRANSFER. The client found exactly that on Didcot and asked whether this
 * should carry both. It should: the panel is headed "What you have paid", and
 * a receipt list that leaves out one of the two things we sell is not one.
 *
 * What counts as a payment is `clubPayments`, not this component. Presentation
 * only, which is what it was before and is the reason the two kinds can share
 * one list without either being bent into the other's shape.
 */
export default function ListingPayments({
  payments,
}: {
  payments: ClubPayment[];
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
        <Stack key={payment.key} spacing={0.4}
          sx={{ pb: 1.5, borderBottom: `1px solid ${tokens.rule}`,
                "&:last-of-type": { borderBottom: 0, pb: 0 } }}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
            <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700 }}>
              {formatPence(payment.amountPence, payment.currency)}
            </Typography>
            {/* Which of the two it was for. A list holding both has to say,
                or a club reading three £20 lines cannot tell a homepage week
                from a quarter of its listing. */}
            <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                              letterSpacing: "0.08em", color: tokens.brass }}>
              {PAYMENT_KIND_LABELS[payment.kind].toUpperCase()}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                              color: tokens.inkMuted }}>
              {[
                shortDate(payment.on),
                methodLabel(payment.method),
                payment.reference,
              ].filter(Boolean).join(" · ")}
            </Typography>
            {refundTag(payment.refundStatus)
              ? <StatusChip label={refundTag(payment.refundStatus)!.label}
                  tone={refundTag(payment.refundStatus)!.tone} />
              : null}
          </Stack>

          {payment.covers ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {`Covers ${shortDate(payment.covers.from)} to `
                + `${shortDate(payment.covers.to)}.`}
            </Typography>
          ) : null}

          {/* The words we wrote down. The dialog that takes them says "The
              club sees this", and this is where they see it. */}
          {payment.note ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {payment.note}
            </Typography>
          ) : null}

          {/* And money going back, which an admin can record since 0233 and
              this page could not show: a club whose listing payment had been
              refunded read a plain receipt for it. */}
          {payment.refundedAt || payment.refundNote ? (
            <Typography variant="body2" sx={{ color: tokens.danger }}>
              {[
                payment.refundedAt
                  ? `Refunded ${shortDate(payment.refundedAt.slice(0, 10))}`
                  : "Refunded",
                payment.refundMethod ? `by ${methodLabel(payment.refundMethod)}` : "",
              ].filter(Boolean).join(" ")}
              {payment.refundNote ? ` · ${payment.refundNote}` : ""}
            </Typography>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
