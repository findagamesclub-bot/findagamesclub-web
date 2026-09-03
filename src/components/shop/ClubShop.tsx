"use client";

import { startTransition, useActionState, useState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBagOutlined";
import BagDrawer from "./BagDrawer";
import MerchCard from "./MerchCard";
import BusyOverlay from "@/components/ui/BusyOverlay";
import { useMerchBag } from "@/hooks/useMerchBag";
import { shopAction, type ShopState } from "@/app/clubs/[slug]/shop/actions";
import { priceBag } from "@/utils/merch-bag";
import { formatPence } from "@/utils/format";
import { tokens, type Faction } from "@/lib/tokens";
import type { MerchItem, ShopStanding } from "@/types/clubExtras";

/**
 * The club shop.
 *
 * Ordering is a request, not a checkout: no payment, because the club settles
 * this by hand. It is still a bag rather than one item at a time, which is what
 * legacy does and what the client asked for. Buying a shirt and a jumper used
 * to be two orders, two notifications and two conversations about payment.
 */
export default function ClubShop({
  items, faction, monogram, slug, clubId, profileId, standing,
}: {
  items: MerchItem[];
  faction: Faction;
  monogram: string;
  slug: string;
  clubId: number;
  profileId: string;
  standing: ShopStanding;
}) {
  const [state, submit, busy] = useActionState<ShopState, FormData>(shopAction, {});
  useActionToast(state);

  const bagStore = useMerchBag(clubId, profileId, items);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [points, setPoints] = useState(0);

  const bag = priceBag({ lines: bagStore.lines, items, standing, points });
  const held = new Map(bagStore.lines.map((line) => [line.itemId, line.quantity]));

  const checkout = () => {
    const data = new FormData();
    data.set("intent", "order-bag");
    data.set("slug", slug);
    data.set("lines", JSON.stringify(bagStore.lines));
    data.set("notes", notes);
    data.set("redeemPoints", String(points));
    startTransition(() => submit(data));

    // Emptied here rather than on the result: the action revalidates the page,
    // and a bag still full behind a success toast invites a second order.
    bagStore.clear();
    setOpen(false);
    setNotes("");
    setPoints(0);
  };

  return (
    <Stack spacing={2.5}>
      <BusyOverlay busy={busy} label="Placing your order">
        <Box sx={{ display: "grid", gap: 2,
                   gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" } }}>
          {items.map((item) => (
            <MerchCard key={item.id} item={item} faction={faction} monogram={monogram}
              busy={busy} standing={standing} inBag={held.get(item.id) ?? 0}
              onAdd={() => bagStore.add(item.id, 1)}
              onQuantity={(quantity) => bagStore.setQuantity(item.id, quantity)} />
          ))}
        </Box>
      </BusyOverlay>

      {standing.discountPercent > 0 ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Prices shown include your {standing.tierLabel ?? "member"} discount of{" "}
          {standing.discountPercent}%.
        </Typography>
      ) : null}

      {/* Pinned to the window, not the page: as a sticky element in the grid it
          was drifting past the container's right edge on a wide screen. Here it
          is always in reach, and it is the only feedback that an Add worked, so
          the drawer no longer barges open on every tap. */}
      {bag.count > 0 && !open ? (
        <Box sx={{ position: "fixed", right: { xs: 16, md: 28 }, bottom: { xs: 16, md: 28 },
                   zIndex: (theme) => theme.zIndex.drawer - 1 }}>
          <Badge badgeContent={bag.count} color="error" overlap="rectangular">
            <Button variant="contained" size="large" startIcon={<ShoppingBagIcon />}
              onClick={() => setOpen(true)}
              sx={{ backgroundColor: faction.base, boxShadow: 6, borderRadius: 999, px: 2.5,
                    "&:hover": { backgroundColor: faction.deep } }}>
              Your bag · {formatPence(bag.total)}
            </Button>
          </Badge>
        </Box>
      ) : null}

      <BagDrawer
        open={open}
        onClose={() => setOpen(false)}
        bag={bag}
        standing={standing}
        faction={faction}
        busy={busy}
        points={points}
        onPoints={setPoints}
        notes={notes}
        onNotes={setNotes}
        onQuantity={bagStore.setQuantity}
        onRemove={bagStore.remove}
        onCheckout={checkout}
      />
    </Stack>
  );
}
