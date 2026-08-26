import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import type { MembershipPayment } from "@/types/payment";

/**
 * The ledger, shown identically to the club and to the member.
 *
 * Same component both sides on purpose: if a club and a member ever read
 * different numbers off the same payments, the argument that follows is not
 * one either of them can settle.
 */
export default function PaymentHistory({
  payments, emptyText,
}: { payments: MembershipPayment[]; emptyText: string }) {
  if (!payments.length) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <Stack>
      {payments.map((p) => (
        <Stack key={p.id} direction="row" spacing={2}
          sx={{ py: 1.25, borderTop: `1px solid ${tokens.rule}`, alignItems: "baseline" }}>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem",
                            fontWeight: 600, minWidth: 56 }}>
            {p.price}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2">{p.billingOptionLabel} · {p.tierLabel}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
              {p.periodEnd ? `Covers to ${shortDate(p.periodEnd)}` : "One-off, no renewal"}
              {p.note ? ` · ${p.note}` : ""}
            </Typography>
          </Box>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                            color: tokens.inkMuted, flexShrink: 0 }}>
            {shortDate(p.recordedAt)}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
