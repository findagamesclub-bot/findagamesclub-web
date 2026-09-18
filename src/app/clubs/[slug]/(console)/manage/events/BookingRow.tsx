"use client";

import { useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { PAYMENT_LABELS, REFUND_LABELS, type RefundStatus } from "@/utils/door-list";
import { formatMoney } from "@/utils/format";
import { nightLabel } from "@/utils/dates";
import { FROM_MANAGE_BOOKINGS } from "@/utils/back-link";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { ClubBookingRow } from "@/types/eventEditor";

/**
 * One booking on the club's whole list.
 *
 * The roster's row with the event named on it, because here the same person
 * can appear three times for three different days and "Gulnabi Afridi, £38,
 * unpaid" three times over is a list nobody can act on.
 */
export default function BookingRow({
  slug, row, busy, faction, onCheckIn, onPayment, onCancel, onEdit, onRefund,
}: {
  slug: string;
  row: ClubBookingRow;
  /** True only for the row being saved, so one spinner marks one action. */
  busy: boolean;
  faction: Faction;
  onCheckIn: (arrived: boolean) => void;
  onPayment: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onRefund: (status: RefundStatus) => void;
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const cancelled = row.status === "cancelled";
  const paid = row.paymentStatus !== "unpaid";
  const pick = (run: () => void) => () => { setMenu(null); run(); };
  // Stamped so the page they land on knows to send them back here rather than
  // to the event's editor, which is not where they came from.
  const goingTo = `/clubs/${slug}/manage/events/${row.eventId}/roster`
    + `?from=${FROM_MANAGE_BOOKINGS}`;

  return (
    <Box sx={{ display: "grid", gap: 1.25, alignItems: "center", p: 1.75,
               borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
               backgroundColor: tokens.paper, opacity: cancelled ? 0.72 : 1,
               gridTemplateColumns: { xs: "minmax(0, 1fr) auto",
                                      md: "minmax(0, 1.3fr) minmax(0, 1fr) auto auto" } }}>
      <Stack spacing={0.35} sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700,
                            textDecoration: cancelled ? "line-through" : "none" }} noWrap>
            {row.fullName || "No name given"}
          </Typography>
          {row.checkedInAt && !cancelled ? (
            <Chip label="In" size="small"
              sx={{ height: 20, fontSize: "0.65rem", fontFamily: mono,
                    backgroundColor: faction.soft, color: faction.deep }} />
          ) : null}
        </Stack>

        {/* The event, and a way into its own roster. Somebody chasing one
            person usually wants the rest of that day next. */}
        <NextLink href={goingTo} style={{ textDecoration: "none" }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", letterSpacing: "0.08em",
                            color: tokens.inkMuted,
                            "&:hover": { color: faction.deep } }} noWrap>
            {[row.eventTitle, row.eventStartDate ? nightLabel(row.eventStartDate) : ""]
              .filter(Boolean).join(" · ").toUpperCase()}
          </Typography>
        </NextLink>

        <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", letterSpacing: "0.08em",
                          color: tokens.inkMuted }} noWrap>
          {[row.reference, `${row.tickets} ${row.tickets === 1 ? "ticket" : "tickets"}`,
            row.email].filter(Boolean).join(" · ").toUpperCase()}
        </Typography>
      </Stack>

      <Stack spacing={0.2} sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", md: "auto" } }}>
        <Typography variant="body2"
          sx={{ color: cancelled ? tokens.inkMuted : paid ? tokens.positive : tokens.ink,
                textDecoration: cancelled ? "line-through" : "none" }}>
          {formatMoney(row.total, "GBP")} · {PAYMENT_LABELS[row.paymentStatus]}
          {row.paymentMethod ? ` (${row.paymentMethod})` : ""}
        </Typography>
        {cancelled ? (
          <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
            {[row.cancelReason || "Cancelled",
              row.refundStatus === "not_due" ? "" : REFUND_LABELS[row.refundStatus]]
              .filter(Boolean).join(" · ")}
          </Typography>
        ) : null}
      </Stack>

      {cancelled ? (
        <Typography variant="body2"
          sx={{ color: tokens.inkMuted, justifySelf: "end", whiteSpace: "nowrap" }}>
          Cancelled
        </Typography>
      ) : (
        // The label holds still and a spinner takes the start slot, which is
        // the rule everywhere: a button that rewrites itself to "Checking in…"
        // reads as filler.
        <Button size="small" variant={row.checkedInAt ? "text" : "outlined"}
          loading={busy} loadingPosition="start"
          aria-label={busy
            ? `${row.checkedInAt ? "Undoing check in" : "Checking in"} ${row.fullName}`
            : undefined}
          onClick={() => onCheckIn(!row.checkedInAt)}
          sx={{ justifySelf: "end", flexShrink: 0,
                color: row.checkedInAt ? tokens.positive : undefined }}>
          {row.checkedInAt ? "Checked in" : "Check in"}
        </Button>
      )}

      <IconButton size="small" disabled={busy}
        aria-label={`More for ${row.fullName || row.reference}`}
        onClick={(event) => setMenu(event.currentTarget)}
        sx={{ justifySelf: "end", color: tokens.inkMuted }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}>
        {!cancelled ? <MenuItem onClick={pick(onPayment)}>Record payment</MenuItem> : null}
        <MenuItem onClick={pick(onEdit)}>Edit the booking</MenuItem>
        <MenuItem component={NextLink} href={goingTo}>
          Everybody coming to this event
        </MenuItem>
        {!cancelled ? (
          <MenuItem onClick={pick(onCancel)} sx={{ color: tokens.danger }}>
            Cancel this place
          </MenuItem>
        ) : null}
        {cancelled && row.refundStatus === "due" ? (
          <MenuItem onClick={pick(() => onRefund("refunded"))}>Mark as refunded</MenuItem>
        ) : null}
        {cancelled && row.refundStatus === "refunded" ? (
          <MenuItem onClick={pick(() => onRefund("due"))}>Mark as still owed</MenuItem>
        ) : null}
      </Menu>
    </Box>
  );
}
