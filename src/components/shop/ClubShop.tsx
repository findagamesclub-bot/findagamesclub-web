"use client";

import { startTransition, useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import MerchCard from "./MerchCard";
import BusyOverlay from "@/components/ui/BusyOverlay";
import { shopAction, type ShopState } from "@/app/clubs/[slug]/shop/actions";
import { amountOf } from "@/utils/cart-pricing";
import { formatMoney } from "@/utils/format";
import { tokens, type Faction } from "@/lib/tokens";
import type { MerchItem, ShopStanding } from "@/types/clubExtras";

/**
 * The club shop.
 *
 * Ordering is a request, not a checkout — no cart and no payment, because the
 * club settles this by hand. The dialog exists so somebody can say "medium,
 * please" before the club goes and orders it.
 */
export default function ClubShop({
  items, faction, monogram, slug, standing,
}: {
  items: MerchItem[];
  faction: Faction;
  monogram: string;
  slug: string;
  standing: ShopStanding;
}) {
  const [state, submit, busy] = useActionState<ShopState, FormData>(shopAction, {});
  const [chosen, setChosen] = useState<MerchItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [points, setPoints] = useState(0);

  const unit = amountOf(chosen?.price);
  const gross = unit * quantity;
  const discount = Math.round(gross * standing.discountPercent) / 100;
  const afterTier = Math.max(gross - discount, 0);

  // Points only appear when the club has actually made them spendable: a value
  // per point and a cap above zero. Didcot sets the cap to 0, so its members
  // never see this at all.
  const canRedeem = Boolean(standing.pointValue) && standing.redemptionCapPercent > 0
    && standing.points > 0;
  const ceiling = Math.round(afterTier * standing.redemptionCapPercent) / 100;
  const maxPoints = canRedeem
    ? Math.min(standing.points, Math.floor(ceiling / (standing.pointValue || 1)))
    : 0;
  const pointsOff = Math.round(points * (standing.pointValue || 0) * 100) / 100;
  const total = Math.max(afterTier - pointsOff, 0);

  const send = () => {
    if (!chosen) return;
    const data = new FormData();
    data.set("intent", "order");
    data.set("slug", slug);
    data.set("itemId", String(chosen.id));
    data.set("quantity", String(quantity));
    data.set("notes", notes);
    data.set("redeemPoints", String(points));
    startTransition(() => submit(data));
    setChosen(null);
    setQuantity(1);
    setNotes("");
    setPoints(0);
  };

  return (
    <Stack spacing={2.5}>
      {state.error ? <Alert severity="error">{state.error}</Alert> : null}
      {state.notice ? <Alert severity="success">{state.notice}</Alert> : null}

      <BusyOverlay busy={busy} label="Placing your order">
      <Box sx={{ display: "grid", gap: 2,
                 gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" } }}>
        {items.map((item) => (
          <MerchCard key={item.id} item={item} faction={faction} monogram={monogram}
            busy={busy} onOrder={(i) => { setChosen(i); setQuantity(1); }} />
        ))}
      </Box>
      </BusyOverlay>

      <Dialog open={Boolean(chosen)} onClose={() => setChosen(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pr: 6 }}>
          Order {chosen?.name}
          <IconButton onClick={() => setChosen(null)} aria-label="Close"
            sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Stack direction="row" spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>How many?</Typography>
              <Stack direction="row" sx={{ alignItems: "center",
                                           border: `1px solid ${faction.base}`, borderRadius: 999 }}>
                <IconButton size="small" disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => q - 1)} aria-label="One fewer">
                  <RemoveIcon sx={{ fontSize: 17 }} />
                </IconButton>
                <Box sx={{ minWidth: 30, textAlign: "center" }}>
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {quantity}
                  </Typography>
                </Box>
                <IconButton size="small"
                  disabled={quantity >= Math.min(20, chosen?.stock ?? 20)}
                  onClick={() => setQuantity((q) => q + 1)} aria-label="One more">
                  <AddIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Stack>
            </Stack>

            <TextField label="Anything the club should know?" multiline minRows={2} fullWidth
              value={notes} onChange={(e) => setNotes(e.target.value)}
              helperText="Size, colour, when you need it by." />

            {canRedeem ? (
              <TextField
                type="number" label="Points to use" fullWidth
                value={points || ""}
                onChange={(e) => setPoints(Math.max(0, Math.min(maxPoints, Number(e.target.value) || 0)))}
                helperText={`You have ${standing.points}. Up to ${maxPoints} on this order.`}
                slotProps={{ htmlInput: { min: 0, max: maxPoints } }}
              />
            ) : null}

            <Stack spacing={0.5} sx={{ p: 1.75, borderRadius: 1.5,
                                       border: `1px solid ${tokens.rule}` }}>
              <Row label={`${quantity} × ${chosen?.price ?? "—"}`} value={formatMoney(gross)} />
              {discount > 0 ? (
                <Row label={`${standing.tierLabel ?? "Member"} discount · ${standing.discountPercent}%`}
                  value={`− ${formatMoney(discount)}`} tone={tokens.positive} />
              ) : null}
              {pointsOff > 0 ? (
                <Row label={`${points} points`} value={`− ${formatMoney(pointsOff)}`}
                  tone={tokens.positive} />
              ) : null}
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline",
                                           pt: 0.75, borderTop: `1px solid ${tokens.rule}` }}>
                <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Total</Typography>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.15rem",
                                  fontWeight: 700 }}>
                  {formatMoney(total)}
                </Typography>
              </Stack>
            </Stack>

            <Box sx={{ p: 1.75, borderRadius: 1.5, backgroundColor: tokens.surface,
                       border: `1px solid ${tokens.rule}` }}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                This puts a request in with the club. They will confirm the price and
                arrange payment with you directly.
              </Typography>
            </Box>

            <Button variant="contained" size="large" fullWidth loading={busy}
              loadingPosition="start" onClick={send}
              sx={{ backgroundColor: faction.base,
                    "&:hover": { backgroundColor: faction.deep } }}>
              Place the order
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography variant="body2" sx={{ color: tone ?? tokens.inkMuted }}>{label}</Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem", color: tone }}>
        {value}
      </Typography>
    </Stack>
  );
}
