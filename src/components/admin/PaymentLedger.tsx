"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import MoneyHistory from "@/components/money/MoneyHistory";
import EditPaymentDialog, { type EditablePayment } from "./EditPaymentDialog";
import { methodLabel } from "@/utils/listing-billing";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { refundTag, type RefundStatus } from "@/utils/refund-status";
import type { MoneyEvent } from "@/utils/money-events";
import { mono, tokens } from "@/lib/tokens";

export type LedgerPayment = EditablePayment & {
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  refundedAt: string | null;
  editedAt: string | null;
};

/**
 * Every payment on one listing, and what has happened to each of them.
 *
 * This used to be an unanswerable screen: it said "the ledger cannot be edited
 * afterwards, by anybody, so what is on it is what happened", which was true
 * and was the thing the client was asking about. An admin who fat-fingered a
 * figure had the SQL console and nothing else.
 *
 * Each row now carries its own log, which is the shop order's shape and the
 * one the client asked the whole site to copy. The log is the audit trail that
 * makes the Edit button safe: a correction is a line that says so, not a
 * silent overwrite.
 */
export default function PaymentLedger({
  payments, subscription, clubName, history,
}: {
  payments: LedgerPayment[];
  subscription: number;
  clubName: string;
  /** Keyed by payment id. Empty is fine; a row just shows no log. */
  history: Record<number, MoneyEvent[]>;
}) {
  const [editing, setEditing] = useState<LedgerPayment | null>(null);

  if (!payments.length) {
    return (
      <EmptyState
        title="Nothing recorded yet"
        description="Payments show here as they are written down. Every change to one is kept on the row beneath it, so the ledger says what happened and when."
      />
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {payments.map((payment) => {
          const refund = refundTag(payment.refundStatus as RefundStatus);
          const log = history[payment.id] ?? [];

          return (
            <Stack key={payment.id} spacing={0.75}
              sx={{ pb: 1.75, borderBottom: `1px solid ${tokens.rule}`,
                    "&:last-of-type": { borderBottom: 0, pb: 0 } }}>
              <Stack direction="row" spacing={1}
                sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
                <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700 }}>
                  {formatPence(payment.amountPence, payment.currency)}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                  color: tokens.inkMuted }}>
                  {[
                    shortDate(payment.paidAt.slice(0, 10)),
                    methodLabel(payment.method),
                    payment.reference,
                  ].filter(Boolean).join(" · ")}
                </Typography>
                {refund ? <StatusChip label={refund.label} tone={refund.tone} /> : null}
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="text"
                  onClick={() => setEditing(payment)} sx={{ minWidth: 0 }}>
                  Edit
                </Button>
              </Stack>

              {payment.periodStart && payment.periodEnd ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {`Bought ${shortDate(payment.periodStart.slice(0, 10))} to `
                    + `${shortDate(payment.periodEnd.slice(0, 10))}.`}
                </Typography>
              ) : null}

              {payment.note ? (
                <Typography variant="body2">{payment.note}</Typography>
              ) : null}

              {log.length ? (
                <Box sx={{ pt: 0.75 }}>
                  <MoneyHistory events={log} dense shownNote={payment.note} />
                </Box>
              ) : null}
            </Stack>
          );
        })}
      </Stack>

      <EditPaymentDialog payment={editing} subscription={subscription}
        clubName={clubName} onClose={() => setEditing(null)} />
    </>
  );
}
