"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import PaymentHistory from "./PaymentHistory";
import { tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import type { MembershipPayment, PaymentStanding } from "@/types/payment";

/**
 * The member's own view of what they have paid this club.
 *
 * The status line is the button. A member checking whether they owe money is
 * already looking at the date, so making that the thing they click saves a
 * control the panel does not have room for.
 */
export default function MyPaymentsDialog({
  clubName, tierLabel, standing, payments,
}: {
  clubName: string;
  tierLabel: string | null;
  standing: PaymentStanding;
  payments: MembershipPayment[];
}) {
  const [open, setOpen] = useState(false);
  const fullScreen = useMediaQuery("(max-width:600px)");

  const paidThrough = shortDate(standing.paidThrough);
  const label = standing.settledOneOff
    ? "ONE-OFF FEE PAID"
    : paidThrough
      ? `${standing.overdue ? "SUBSCRIPTION LAPSED " : "PAID TO "}${paidThrough.toUpperCase()}`
      : null;

  if (!label && !payments.length) return null;

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(true)}
        sx={{
          p: 0, border: 0, bgcolor: "transparent", cursor: "pointer", font: "inherit",
          textAlign: "left", alignSelf: "flex-start",
          fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.04em",
          fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3,
          color: standing.overdue ? tokens.danger : tokens.positive,
        }}
      >
        {label ?? "PAYMENT HISTORY"}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontSize: "1.15rem" }}>Your payments</Typography>
              <Typography variant="body2" color="text.secondary">
                {clubName}{tierLabel ? ` · ${tierLabel}` : ""}
              </Typography>
            </Box>
            <IconButton onClick={() => setOpen(false)} aria-label="Close" sx={{ flexShrink: 0 }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <PaymentHistory
            payments={payments}
            emptyText="The club has not recorded any payments from you yet."
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, fontSize: "0.82rem" }}>
            Payments are taken by the club, not through this site. If something here looks
            wrong, speak to {clubName} directly.
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
}
