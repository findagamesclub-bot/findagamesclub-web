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
export default function MerchCard({
  item, faction, monogram, busy, standing, inBag, onAdd, onQuantity,
}: {
  item: MerchItem;
  faction: Faction;
  monogram: string;
  busy: boolean;
  /** What this viewer pays, and what a better tier would pay. */
  standing: ShopStanding;
  /** How many of this are already in the bag. */
  inBag: number;
  onAdd: () => void;
  onQuantity: (quantity: number) => void;
}) {
  const blocked = Boolean(item.blockedReason) || item.soldOut;
  const low = item.stock > 0 && item.stock <= 5;

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
  const [imageFailed, setImageFailed] = useState(false);
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
                              color: low ? tokens.brass : tokens.inkMuted,
                              fontWeight: low ? 700 : 400 }}>
              {item.stock} IN STOCK
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
          {inBag ? (
            <Stack direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between",
                    border: `1px solid ${faction.base}`, borderRadius: 1, px: 0.5, height: 40 }}>
              <IconButton size="small" disabled={busy}
                aria-label={inBag === 1 ? `Remove ${item.name} from your bag` : `One fewer ${item.name}`}
                onClick={() => onQuantity(inBag - 1)}>
                {inBag === 1
                  ? <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                  : <RemoveIcon sx={{ fontSize: 18 }} />}
              </IconButton>

              <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                color: faction.deep }}>
                {inBag} in bag
              </Typography>

              <IconButton size="small"
                disabled={busy || inBag >= Math.min(20, item.stock)}
                aria-label={`One more ${item.name}`}
                onClick={() => onQuantity(inBag + 1)}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          ) : (
            <Button fullWidth variant="contained" disabled={blocked || busy}
              onClick={onAdd}
              sx={{ backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
              {item.soldOut ? "Sold out" : "Add to bag"}
            </Button>
          )}
        </Box>
      </Stack>
    </Stack>
  );
}
