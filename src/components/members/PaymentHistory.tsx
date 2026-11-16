import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import { refundTag } from "@/utils/refund-status";
import StatusChip from "@/components/ui/StatusChip";
import type { MembershipPayment } from "@/types/payment";

/**
 * The ledger, shown identically to the club and to the member.
 *
 * Same component both sides on purpose: if a club and a member ever read
 * different numbers off the same payments, the argument that follows is not
 * one either of them can settle.
 *
 * Each row says three dates and the client asked for all three (item 16): when
 * the money was written down, when the row was last put right, and when it
 * went back. They are separate facts and were never going to fit on one line,
 * so the row is two lines and the money leads.
 */
export default function PaymentHistory({
  payments, emptyText, onEdit,
}: {
  payments: MembershipPayment[];
  emptyText: string;
  /**
   * Given only on the club's side. A member reads the same ledger and the same
   * correction marks, and corrects nothing: the money is the club's record of
   * what arrived.
   */
  onEdit?: (payment: MembershipPayment) => void;
}) {
  if (!payments.length) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <Stack>
      {payments.map((p) => {
        const refund = refundTag(p.refundStatus);
        return (
          <Stack key={p.id} direction="row" spacing={2}
            sx={{ py: 1.25, borderTop: `1px solid ${tokens.rule}`, alignItems: "baseline" }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.8rem",
                              fontWeight: 600, minWidth: 56 }}>
              {p.price}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                <Typography variant="body2">
                  {p.billingOptionLabel} · {p.tierLabel}
                </Typography>
                {/* A status is one tag drawn one way. `refundTag` draws nothing
                    at all when nothing is owed, which is almost every row. */}
                {refund ? <StatusChip label={refund.label} tone={refund.tone} /> : null}
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                {p.periodEnd ? `Covers to ${shortDate(p.periodEnd)}` : "One-off, no renewal"}
                {p.note ? ` · ${p.note}` : ""}
                {/* A correction leaves a mark. The ledger stopped being
                    insert-only in 0195, and a row that could change without
                    saying so would be worse than one that could not change. */}
                {p.editedAt ? ` · Corrected ${shortDate(p.editedAt)}` : ""}
              </Typography>

              {/* The date the money went back, which is the half the client
                  asked for and the half an accounts record needs. */}
              {p.refundedAt ? (
                <Typography variant="body2"
                  sx={{ fontSize: "0.8rem", color: tokens.danger }}>
                  {[`Refunded ${shortDate(p.refundedAt)}`,
                    p.refundMethod ? `by ${p.refundMethod}` : "",
                  ].filter(Boolean).join(" ")}
                  {p.refundNote ? ` · ${p.refundNote}` : ""}
                </Typography>
              ) : null}
            </Box>

            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                              color: tokens.inkMuted, flexShrink: 0 }}>
              {shortDate(p.recordedAt)}
            </Typography>
            {onEdit ? (
              <Button size="small" variant="text" onClick={() => onEdit(p)}
                sx={{ flexShrink: 0, minWidth: 0 }}>
                Edit
              </Button>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
