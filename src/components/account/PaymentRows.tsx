import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { MembershipPayment } from "@/types/payment";

/**
 * The member's copy of the club's ledger.
 *
 * Clubs take cash at the door, so these are records an owner typed in rather
 * than card charges. A member could previously only take the club's word for it.
 */
export default function PaymentRows({ payments }: { payments: MembershipPayment[] }) {
  return (
    <Box sx={{ maxHeight: payments.length > 4 ? 200 : "none",
               overflowY: payments.length > 4 ? "auto" : "visible" }}>
      {payments.map((payment) => (
        <Stack key={payment.id} direction="row" spacing={1.5}
          sx={{ py: 1, alignItems: "baseline",
                "&:not(:last-of-type)": { borderBottom: `1px solid ${tokens.rule}` } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {payment.tierLabel}
              {payment.billingOptionLabel ? ` · ${payment.billingOptionLabel}` : ""}
            </Typography>
            <Typography sx={{ fontSize: "0.76rem", color: tokens.inkMuted }}>
              {payment.periodEnd
                ? `Covers to ${shortDate(payment.periodEnd)}`
                : `Recorded ${shortDate(payment.recordedAt)}`}
            </Typography>
          </Box>
          <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                            flexShrink: 0 }}>
            {payment.price}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}
