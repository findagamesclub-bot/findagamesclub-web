"use client";

import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import { priceLines } from "@/utils/shop-pricing";
import { tokens, type Faction } from "@/lib/tokens";
import type { MerchItem, ShopStanding } from "@/types/clubExtras";

/**
 * One thing the club sells.
 *
 * The picture leads, because kit is bought by looking at it. Clubs without an
 * image get the club's colour and its monogram instead of a grey placeholder —
 * an empty box reads as a broken page.
 */
/** What is left of the size in the bag, or of the item when it has none. */
function stockFor(item: MerchItem, variantId: number | null): number {
  const variant = item.variants.find((v) => v.id === variantId);
  return variant && variant.label ? variant.stock : item.stock;
}

/** " · L", so the counter says which size it is counting. */
function sizeOf(item: MerchItem, variantId: number | null): string {
  const label = item.variants.find((v) => v.id === variantId)?.label ?? "";
  return label ? ` · ${label}` : "";
}

export default function MerchCard({
  item, faction, monogram, busy, standing, inBag, onAdd, onQuantity,
}: {
  item: MerchItem;
  faction: Faction;
  monogram: string;
  busy: boolean;
  /** What this viewer pays, and what a better tier would pay. */
  standing: ShopStanding;
  /** What is already in the bag for this item, one entry per size. */
  inBag: { variantId: number | null; quantity: number }[];
  onAdd: (variantId: number | null) => void;
  onQuantity: (quantity: number, variantId: number | null) => void;
}) {
  const held = inBag.reduce((n, line) => n + line.quantity, 0);
  const blocked = Boolean(item.blockedReason) || item.soldOut;

  // Priced for whoever is looking, on the card. It used to show the full price
  // here and the member price only once you opened the order dialog.
  const price = priceLines({
    price: item.price,
    discountPercent: standing.discountPercent,
    tierLabel: standing.tierLabel,
    offer: standing.offer,
  });

  // A club's image can go missing — the legacy uploads were half-copied, and a
  // club could delete one. A broken-image icon with the filename as alt text is
  // worse than no picture, so a failed load falls back to the monogram.
  // Sizes worth choosing between. One variant with no label is an item that
  // does not come in sizes, and gets no picker at all.
  const sizes = item.variants.filter((variant) => variant.label);
  const [size, setSize] = useState<number | null>(
    sizes.length === 1 ? sizes[0]!.id : null,
  );
  const [imageFailed, setImageFailed] = useState(false);

  // Once a size is chosen the header figure is that size's, because the item's
  // total is the sum of every size and answers a question nobody asked.
  const picked = sizes.find((variant) => variant.id === size) ?? null;
  const showing = picked ? picked.stock : item.stock;
  const lowNow = showing > 0 && showing <= 5;

  // A counter can only speak for one line. An item with sizes can always gain
  // another, so it stays a picker and the bag drawer handles the quantities:
  // swapping to a counter after the first size meant the second could never be
  // added at all.
  const only = sizes.length <= 1 && inBag.length === 1 ? inBag[0]! : null;
  const image = imageFailed ? null : item.image;

  return (
    <Stack sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, overflow: "hidden",
                 backgroundColor: tokens.paper, height: "100%" }}>
      <Box sx={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden",
                 backgroundImage: `linear-gradient(140deg, ${faction.deep} 0%, ${faction.base} 100%)`,
                 display: "grid", placeItems: "center" }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.src} alt={image.alt}
            onError={() => setImageFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800,
                            fontSize: "2.6rem", color: "rgba(255,255,255,0.28)" }}>
            {monogram}
          </Typography>
        )}

        {item.soldOut ? (
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                     backgroundColor: "rgba(16,27,45,0.62)" }}>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem",
                              letterSpacing: "0.14em", color: "#fff", fontWeight: 700 }}>
              SOLD OUT
            </Typography>
          </Box>
        ) : null}
      </Box>

      <Stack spacing={0.75} sx={{ p: 2, flex: 1 }}>
        <Stack direction="row" spacing={1.5}
          sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
          <Typography variant="subtitle1" sx={{ lineHeight: 1.25 }}>{item.name}</Typography>

          <Stack direction="row" spacing={0.875}
            sx={{ alignItems: "baseline", flexShrink: 0 }}>
            {price.was ? (
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem",
                                color: tokens.inkMuted, textDecoration: "line-through" }}>
                {price.was}
              </Typography>
            ) : null}
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700,
                              color: price.was ? tokens.brass : tokens.ink }}>
              {price.now}
            </Typography>
          </Stack>
        </Stack>

        {/* Either what your tier saves you, or what a better one would. Both
            are worth saying out loud; neither was said before. */}
        {price.note ? (
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                            letterSpacing: "0.08em", fontWeight: 700,
                            color: price.was ? tokens.brass : tokens.inkMuted }}>
            {price.note.toUpperCase()}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1.25} useFlexGap
          sx={{ flexWrap: "wrap", alignItems: "center" }}>
          {item.category ? (
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              {item.category.toUpperCase()}
            </Typography>
          ) : null}
          {!item.soldOut ? (
            <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                              letterSpacing: "0.08em",
                              color: lowNow ? tokens.brass : tokens.inkMuted,
                              fontWeight: lowNow ? 700 : 400 }}>
              {picked ? `${picked.stock} LEFT IN ${picked.label.toUpperCase()}`
                      : `${item.stock} IN STOCK`}
            </Typography>
          ) : null}
        </Stack>

        {item.blockedReason && !item.soldOut ? (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <LockIcon sx={{ fontSize: 15, color: tokens.inkMuted, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {item.blockedReason}
            </Typography>
          </Stack>
        ) : null}

        {/* Once it is in the bag the button becomes a counter, because a
            button reading "In your bag · 2" that quietly makes it 3 when you
            press it is a trap. Plus adds, minus takes away, zero removes. */}
        <Box sx={{ mt: "auto", pt: 1.25 }}>
          {only ? (
            <Stack direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between",
                    border: `1px solid ${faction.base}`, borderRadius: 1, px: 0.5, height: 40 }}>
              <IconButton size="small" disabled={busy}
                aria-label={only.quantity === 1
                  ? `Remove ${item.name} from your bag`
                  : `One fewer ${item.name}`}
                onClick={() => onQuantity(only.quantity - 1, only.variantId)}>
                {only.quantity === 1
                  ? <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                  : <RemoveIcon sx={{ fontSize: 18 }} />}
              </IconButton>

              <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                color: faction.deep }}>
                {only.quantity} in bag{sizeOf(item, only.variantId)}
              </Typography>

              <IconButton size="small"
                disabled={busy || only.quantity >= Math.min(20, stockFor(item, only.variantId))}
                aria-label={`One more ${item.name}`}
                onClick={() => onQuantity(only.quantity + 1, only.variantId)}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          ) : (
            <Stack spacing={1}>
              {held > 0 ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                  fontWeight: 700, letterSpacing: "0.08em",
                                  color: faction.deep }}>
                  {`${held} IN YOUR BAG · CHANGE THEM IN THE BAG`}
                </Typography>
              ) : null}

              {/* Only when there is a choice to make. An item with one unnamed
                  variant is an item without sizes, which is most of them. */}
              {sizes.length > 1 ? (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {sizes.map((variant) => {
                    const picked = variant.id === size;
                    return (
                      <Button key={variant.id} size="small"
                        variant={picked ? "contained" : "outlined"}
                        disabled={busy || variant.soldOut}
                        onClick={() => setSize(variant.id)}
                        aria-pressed={picked}
                        sx={{ minWidth: 0, px: 1.5,
                              ...(picked ? { backgroundColor: faction.base,
                                             "&:hover": { backgroundColor: faction.deep } }
                                         : { borderColor: tokens.rule, color: tokens.ink }) }}>
                        {/* A size with none left says so rather than vanishing:
                            a club that has run out of mediums has still told
                            you it does mediums. The count is on the button
                            because it is the size's stock that decides whether
                            you can have one, not the item's. */}
                        {variant.label}
                        {variant.soldOut ? " · out" : ` · ${variant.stock}`}
                      </Button>
                    );
                  })}
                </Stack>
              ) : null}

              <Button fullWidth variant="contained"
                disabled={blocked || busy || (sizes.length > 1 && size === null)}
                onClick={() => onAdd(size)}
                sx={{ backgroundColor: faction.base,
                      "&:hover": { backgroundColor: faction.deep } }}>
                {item.soldOut ? "Sold out"
                  : sizes.length > 1 && size === null ? "Choose a size"
                  : "Add to bag"}
              </Button>
            </Stack>
          )}
        </Box>
      </Stack>
    </Stack>
  );
}
