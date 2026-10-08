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
import StatusChip from "@/components/ui/StatusChip";
import { nightLabel } from "@/utils/dates";
import { formatMoney } from "@/utils/format";
import {
  REFUND_STATES, bookingTags, type CoachingBookingRow,
} from "@/utils/coaching-bookings-filter";
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
  row, busy, onPaid, onCancel, onRefund,
}: {
  row: CoachingBookingRow;
  busy: boolean;
  onPaid: (bookingId: number, paid: boolean) => void;
  onCancel: (bookingId: number, reason: string) => void;
  onRefund: (bookingId: number, status: string) => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
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
          {row.pointsSpent > 0 ? ` · ${row.pointsSpent} pts` : ""}
        </Typography>

        {tags.length ? (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <StatusChip key={tag.label} label={tag.label} tone={tag.tone} />
            ))}
          </Stack>
        ) : null}

        {/* The club's own words, so a row nobody can remember explains itself. */}
        {row.cancelReason ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, fontStyle: "italic" }}>
            {row.cancelReason}
          </Typography>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={0.5}
        sx={{ justifySelf: "end", alignItems: "center", flexShrink: 0 }}>
        {row.cancelled ? null : (
          <Button size="small" variant={row.paid ? "text" : "outlined"} disabled={busy}
            onClick={() => onPaid(row.id, !row.paid)}
            sx={{ color: row.paid ? tokens.positive : undefined }}>
            {row.paid ? "Paid" : "Mark paid"}
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

        {/* Only once there is money to be owed. A refund state on a place
            nobody paid for is a control that cannot mean anything. */}
        {row.paid || row.refundStatus !== "not_due"
          ? REFUND_STATES.map((state) => (
            <MenuItem key={state.value}
              selected={row.refundStatus === state.value}
              onClick={() => { setMenu(null); onRefund(row.id, state.value); }}>
              {state.label}
            </MenuItem>
          ))
          : null}
      </Menu>

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
