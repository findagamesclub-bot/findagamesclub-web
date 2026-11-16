"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CoachingPaymentDialog from "./CoachingPaymentDialog";
import StatusChip from "@/components/ui/StatusChip";
import PriceBreakdown from "@/components/ui/PriceBreakdown";
import { nightLabel } from "@/utils/dates";
import { formatMoney } from "@/utils/format";
import {
  bookingTags, type CoachingBookingRow,
} from "@/utils/coaching-bookings-filter";
import MoneyHistory from "@/components/money/MoneyHistory";
import type { MoneyEvent } from "@/utils/money-events";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * One coaching booking, as the club acts on it.
 *
 * The client could do none of this: "Bookings cannot be cancelled or set to
 * refunded by owner." A manager has been allowed to by policy since 0020 and
 * nothing on any screen called it.
 *
 * One primary action in the row and the rest behind a menu, which is the shape
 * the events console already uses. Marking somebody paid is the thing a club
 * does twenty times on a club night; cancelling their place is the thing it
 * does once, and it takes a reason, so it belongs a press further away.
 */
export default function BookingRow({
  row, busy, history, onPaid, onCancel, onRefund,
}: {
  row: CoachingBookingRow;
  busy: boolean;
  /** What has happened to this place's money (0233). */
  history: MoneyEvent[];
  onPaid: (bookingId: number, paid: boolean, note: string) => void;
  onCancel: (bookingId: number, reason: string) => void;
  onRefund: (
    bookingId: number, status: string, method: string, note: string) => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [reason, setReason] = useState("");

  const tags = bookingTags(row);

  return (
    <Box sx={{ display: "grid", gap: 1.5, alignItems: "center", p: 1.75,
               borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
               backgroundColor: tokens.paper,
               opacity: row.cancelled ? 0.78 : 1,
               gridTemplateColumns: {
                 xs: "minmax(0, 1fr) auto",
                 sm: "minmax(0, 1.1fr) minmax(0, 1.3fr) auto" } }}>
      <Stack spacing={0.4} sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700 }}
          noWrap>
          {row.name}
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                          letterSpacing: "0.08em", color: tokens.inkMuted }}>
          {[nightLabel(row.date), row.time].filter(Boolean).join(" · ").toUpperCase()}
        </Typography>
      </Stack>

      {/* The session and what they were charged, on their own line on a phone
          rather than squeezed beside a name that is already truncating. */}
      <Stack spacing={0.5} sx={{ minWidth: 0,
                                 gridColumn: { xs: "1 / -1", sm: "auto" } }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {row.title}
          {row.total > 0 ? ` · ${formatMoney(row.total, "GBP")}` : ""}
        </Typography>

        {/* The points used to sit on the line above as a bare "9 pts", which
            said how many without saying what they were worth, and said nothing
            at all about the tier. A club asked what it is owed deserves to be
            able to answer why. */}
        <PriceBreakdown priced={row.priced} compact />

        {tags.length ? (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <StatusChip key={tag.label} label={tag.label} tone={tag.tone} />
            ))}
          </Stack>
        ) : null}

        {/* What the club wrote beside the money, which the member reads too.
            Under the breakdown rather than beside the name: it is about the
            payment, and that is where the payment is. */}
        {row.paymentNote ? (
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            {row.paymentNote}
          </Typography>
        ) : null}

        {/* And what has happened to the money since (0233): when it arrived,
            when it went back, and what the club wrote about each. */}
        {history.length ? <MoneyHistory events={history} dense shownNote={row.paymentNote} /> : null}

        {/* The club's own words, so a row nobody can remember explains itself. */}
        {row.cancelReason ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, fontStyle: "italic" }}>
            {row.cancelReason}
          </Typography>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={0.5}
        sx={{ justifySelf: "end", alignItems: "center", flexShrink: 0 }}>
        {/* The same two words, in the same order, as a table booking and an
            event ticket. "Paid" used to sit here as the label on a button that
            un-marked the payment when pressed, which reads as a status and
            acts as an undo. */}
        {row.cancelled ? null : (
          <Button size="small" variant={row.paid ? "text" : "outlined"} disabled={busy}
            onClick={() => setPaying(true)}
            sx={{ color: row.paid ? tokens.positive : undefined }}>
            {row.paid ? "Payment" : "Mark paid"}
          </Button>
        )}

        <IconButton size="small" aria-label={`More for ${row.name}`}
          onClick={(event) => setMenu(event.currentTarget)}
          sx={{ color: tokens.inkMuted }}>
          <MoreVertIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {row.cancelled ? null : (
          <MenuItem onClick={() => { setMenu(null); setAsking(true); }}
            sx={{ color: tokens.danger }}>
            Cancel their place
          </MenuItem>
        )}

        {/* The refund used to be three menu items setting a word and nothing
            else, which could not say when the money went back or how. It is
            the payment dialog's second half now, the same two questions a
            table booking asks, so a club learns one control rather than two.
            Only once there is money to be owed: a refund on a place nobody
            paid for is a control that cannot mean anything. */}
        {row.paid || row.refundStatus !== "not_due" ? (
          <MenuItem onClick={() => { setMenu(null); setPaying(true); }}>
            Record a refund
          </MenuItem>
        ) : null}
      </Menu>

      <CoachingPaymentDialog
        row={paying ? row : null}
        saving={busy}
        onClose={() => setPaying(false)}
        onSave={({ paid, note, refundStatus, refundMethod, refundNote }) => {
          onPaid(row.id, paid, note);
          // The payment first, then the refund: the database refuses a refund
          // on a half nothing was taken on, so marking somebody paid and
          // refunded in one press has to record the payment first. Same order
          // a table booking saves in.
          if (refundStatus !== row.refundStatus
              || refundMethod !== row.refundMethod
              || refundNote !== row.refundNote) {
            onRefund(row.id, refundStatus, refundMethod, refundNote);
          }
          setPaying(false);
        }}
      />

      <ConfirmDialog
        open={asking}
        title="Cancel their place?"
        body={<Stack spacing={1.5}>
          <Typography variant="body2">
            {`${row.name} loses their place on ${row.title}, and is told. `}
            {row.paid
              ? "They paid, so the refund is marked as due for you to settle."
              : "Nothing was paid, so nothing is owed."}
            {row.pointsSpent > 0
              ? ` Their ${row.pointsSpent} points come back automatically.`
              : ""}
          </Typography>
          <TextField size="small" fullWidth label="Why" value={reason}
            onChange={(event) => setReason(event.target.value)}
            helperText="They see this. Leave it blank and they are told the club cancelled it."
            slotProps={{ htmlInput: { maxLength: 300 } }} />
        </Stack>}
        confirmLabel="Cancel their place"
        cancelLabel="Leave it"
        destructive
        busy={busy}
        onConfirm={() => { onCancel(row.id, reason); setAsking(false); setReason(""); }}
        onClose={() => setAsking(false)}
      />
    </Box>
  );
}
