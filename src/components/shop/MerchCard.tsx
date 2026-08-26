"use client";

import { useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import { tokens, type Faction } from "@/lib/tokens";
import type { MerchItem } from "@/types/clubExtras";

/**
 * One thing the club sells.
 *
 * The picture leads, because kit is bought by looking at it. Clubs without an
 * image get the club's colour and its monogram instead of a grey placeholder —
 * an empty box reads as a broken page.
 */
export default function MerchCard({
  item, faction, monogram, busy, onOrder,
}: {
  item: MerchItem;
  faction: Faction;
  monogram: string;
  busy: boolean;
  onOrder: (item: MerchItem) => void;
}) {
  const blocked = Boolean(item.blockedReason) || item.soldOut;
  const low = item.stock > 0 && item.stock <= 5;

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
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700,
                            flexShrink: 0 }}>
            {item.price ?? "—"}
          </Typography>
        </Stack>

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

        <Box sx={{ mt: "auto", pt: 1.25 }}>
          <Button fullWidth variant="contained" disabled={blocked || busy}
            onClick={() => onOrder(item)}
            sx={{ backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
            {item.soldOut ? "Sold out" : "Order"}
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
