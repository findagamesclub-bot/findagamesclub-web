"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Counter from "@/components/ui/Counter";
import MoneyHistory from "@/components/money/MoneyHistory";
import { MONEY_AUDIENCES, type MoneyAudience } from "@/utils/money-events";
import { formatMoney, initialsOf } from "@/utils/format";
import { needsQuote } from "@/utils/merch-bag";
import { orderTotalLabel } from "@/utils/order-total";
import { messageTime } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { MerchOrder } from "@/types/clubExtras";

/**
 * One order, as the club works it.
 *
 * Split out of `OrderQueue` when the note box grew an audience: the queue is
 * the filtering, the paging and the writes, and this is the card. The card
 * holds no state of its own, so the queue can keep one draft and one audience
 * per order and clear them when a note lands.
 */

export const STATES: { value: MerchOrder["status"]; label: string; tone: string }[] = [
  { value: "placed", label: "Placed", tone: tokens.brass },
  { value: "paid", label: "Paid", tone: tokens.brand },
  { value: "fulfilled", label: "Fulfilled", tone: tokens.positive },
  { value: "cancelled", label: "Cancelled", tone: tokens.inkMuted },
  // Brass for work waiting and red for money gone, the same pair coaching,
  // events and table payments draw.
  { value: "refund_due", label: "Refund due", tone: tokens.brass },
  { value: "refunded", label: "Refunded", tone: tokens.danger },
];

export default function OrderCard({
  order, faction, busy, draft, audience,
  onDraft, onAudience, onStatus, onEditRefund, onAddNote,
}: {
  order: MerchOrder;
  faction: Faction;
  busy: boolean;
  draft: string;
  audience: MoneyAudience;
  onDraft: (value: string) => void;
  onAudience: (value: MoneyAudience) => void;
  onStatus: (status: string) => void;
  onEditRefund: () => void;
  onAddNote: () => void;
}) {
  const tone = STATES.find((s) => s.value === order.status)?.tone ?? tokens.inkMuted;
  const inRefund = order.status === "refunded" || order.status === "refund_due";
  const says = MONEY_AUDIENCES.find((one) => one.value === audience)?.says;

  return (
    <Box
      sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 2,
            backgroundColor: order.status === "cancelled" ? tokens.surface : tokens.paper,
            opacity: order.status === "cancelled" ? 0.75 : 1 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", mb: 1.5 }}>
        <Counter kind="person" faction={faction} primary={initialsOf(order.personName)} />

        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1">{order.personName}</Typography>
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.08em", color: tokens.inkMuted }}>
            {messageTime(order.createdAt)}
            {order.tierLabel ? ` · ${order.tierLabel.toUpperCase()}` : ""}
          </Typography>
        </Stack>

        <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                          letterSpacing: "0.1em", fontWeight: 700, color: tone,
                          flexShrink: 0 }}>
          {order.status.toUpperCase()}
        </Typography>
      </Stack>

      <Stack spacing={0.5} sx={{ pl: { xs: 0, sm: 7 }, mb: 1.5 }}>
        {order.lines.map((line, i) => (
          <Stack key={i} direction="row" spacing={2}
            sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Typography variant="body2">
              <Box component="span" sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                          color: faction.deep, mr: 0.75 }}>
                {line.quantity}&times;
              </Box>
              {line.name}
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
              {line.price ?? "—"}
            </Typography>
          </Stack>
        ))}

        {order.notes ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted, pt: 0.5 }}>
            &ldquo;{order.notes}&rdquo;
          </Typography>
        ) : null}

        {/* The money as it stood when they ordered, so a later reprice
            cannot rewrite what the club quoted. */}
        <Stack spacing={0.25} sx={{ pt: 0.75 }}>
          {order.discountAmount > 0 ? (
            <Typography variant="body2" sx={{ color: tokens.positive }}>
              {order.discountPercent}% {order.tierLabel ?? "member"} discount
              &mdash; {formatMoney(order.discountAmount)} off
            </Typography>
          ) : null}
          {order.pointsSpent > 0 ? (
            <Typography variant="body2" sx={{ color: tokens.positive }}>
              {order.pointsSpent} points used &mdash; {formatMoney(order.pointsValue)} off
            </Typography>
          ) : null}
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem",
                            fontWeight: 700 }}>
            {orderTotalLabel(order, formatMoney)}
            {order.lines.every((l) => needsQuote(l.price)) ? "" : " total"}
          </Typography>
        </Stack>
      </Stack>

      <Stack spacing={1.5} sx={{ pl: { xs: 0, sm: 7 } }}>
        <Stack direction="row" spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
          <TextField select size="small" label="Status" value={order.status}
            disabled={busy || order.status === "cancelled"}
            onChange={(event) => onStatus(event.target.value)}
            sx={{ minWidth: 150 }}>
            {STATES.map((one) => (
              <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
            ))}
          </TextField>

          {/* Picking a status that is already set fires no change, so once an
              order was refunded the note the member reads could never be
              corrected and the club typed into the box below instead. That is
              the other half of the client's item 19. */}
          {inRefund ? (
            <Button size="small" variant="outlined" disabled={busy}
              onClick={onEditRefund}>
              Edit the refund
            </Button>
          ) : null}
        </Stack>

        {/* A log, not a field. Notes are added; nothing overwrites the last
            one, and a payment, a refund or a status move writes its own line.
            Since 0233 it is the same log, drawn the same way, that a table
            booking and a renewal carry, and since 0238 each typed line says
            who reads it. */}
        {order.log.length ? (
          <MoneyHistory events={order.log} dense showAudience />
        ) : null}

        {/* The audience is a control, not a sentence in helper text. A club
            wrote "refund processed back to your card you paid on. thanks"
            into this box under a line saying only the club team reads it,
            which is the client's item 18: being told who reads a box is not
            the same as choosing. */}
        <Stack spacing={1}>
          <TextField size="small" label="Add a note" fullWidth multiline maxRows={4}
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 2000 } }} />

          <Stack direction="row" spacing={1}
            sx={{ alignItems: "flex-start", flexWrap: "wrap" }} useFlexGap>
            <TextField select size="small" label="Who reads it" value={audience}
              onChange={(event) => onAudience(event.target.value as MoneyAudience)}
              helperText={says}
              sx={{ flex: 1, minWidth: 190 }}>
              {MONEY_AUDIENCES.map((one) => (
                <MenuItem key={one.value} value={one.value}>{one.label}</MenuItem>
              ))}
            </TextField>

            <Button size="small" variant="outlined"
              sx={{ flexShrink: 0, mt: 0.5, alignSelf: "flex-start" }}
              disabled={busy || !draft.trim()}
              onClick={onAddNote}>
              Add
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
