"use client";

import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import BagSummary from "./BagSummary";
import { formatPence } from "@/utils/format";
import { MAX_PER_LINE, type BagTotal } from "@/utils/merch-bag";
import { tokens, type Faction } from "@/lib/tokens";
import type { ShopStanding } from "@/types/clubExtras";

/** The bag, and everything that comes off the price before you pay it. */
export default function BagDrawer({
  open, onClose, bag, standing, faction, busy,
  points, onPoints, notes, onNotes,
  onQuantity, onRemove, onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  bag: BagTotal;
  standing: ShopStanding;
  faction: Faction;
  busy: boolean;
  points: number;
  onPoints: (value: number) => void;
  notes: string;
  onNotes: (value: string) => void;
  onQuantity: (itemId: number, quantity: number) => void;
  onRemove: (itemId: number) => void;
  onCheckout: () => void;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 480, md: 560 } } } }}>
      <Stack sx={{ height: "100%" }}>
        <Stack direction="row" spacing={2}
          sx={{ p: 2, alignItems: "center", justifyContent: "space-between",
                borderBottom: `1px solid ${tokens.rule}` }}>
          <Typography variant="h3" sx={{ fontSize: "1.15rem" }}>
            Your bag{bag.count ? ` · ${bag.count}` : ""}
          </Typography>
          <IconButton onClick={onClose} aria-label="Close the bag">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stack spacing={2} sx={{ p: 2, flex: 1, overflowY: "auto", minHeight: 0 }}>
          {bag.lines.length === 0 ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, py: 4, textAlign: "center" }}>
              Nothing in here yet. Add something from the shop.
            </Typography>
          ) : null}

          {bag.lines.map((line) => (
            <Stack key={line.itemId} spacing={0.75}
              sx={{ pb: 1.5, borderBottom: `1px solid ${tokens.rule}` }}>
              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2">{line.name}</Typography>
                  {/* What one costs, so a line total of £40.50 is arithmetic
                      the reader can follow rather than a number to trust. */}
                  <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                    {line.quoted
                      ? `${line.quantity} × price on request`
                      : `${line.quantity} × ${formatPence(
                          Math.max(line.unitAmount - line.unitDiscount, 0))}`}
                  </Typography>
                </Box>
                {/* Never £0. The club has not named a price, which is not the
                    same as the thing being free, and a member reading £0 will
                    reasonably expect to pay nothing. */}
                <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                  flexShrink: 0,
                                  color: line.quoted ? tokens.inkMuted : undefined,
                                  fontSize: line.quoted ? "0.8rem" : undefined }}>
                  {line.quoted ? "To be priced" : formatPence(line.lineTotal)}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row"
                  sx={{ alignItems: "center", border: `1px solid ${tokens.rule}`,
                        borderRadius: 999 }}>
                  <IconButton size="small" aria-label={`One fewer ${line.name}`}
                    disabled={line.quantity <= 1}
                    onClick={() => onQuantity(line.itemId, line.quantity - 1)}>
                    <RemoveIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                  <Box sx={{ minWidth: 28, textAlign: "center" }}>
                    <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      {line.quantity}
                    </Typography>
                  </Box>
                  <IconButton size="small" aria-label={`One more ${line.name}`}
                    disabled={line.quantity >= Math.min(MAX_PER_LINE, line.stock)}
                    onClick={() => onQuantity(line.itemId, line.quantity + 1)}>
                    <AddIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Stack>

                <IconButton size="small" aria-label={`Remove ${line.name}`}
                  onClick={() => onRemove(line.itemId)}>
                  <DeleteOutlinedIcon sx={{ fontSize: 19, color: tokens.inkMuted }} />
                </IconButton>
              </Stack>

              {/* A bag can sit for weeks. Whatever changed while it did is said
                  on the line it changed, not as one vague warning at the top. */}
              {line.problem ? (
                <Typography variant="caption" sx={{ color: tokens.danger, fontWeight: 600 }}>
                  {line.problem}
                </Typography>
              ) : null}
            </Stack>
          ))}
        </Stack>

        {bag.lines.length ? (
          <BagSummary bag={bag} standing={standing} faction={faction} busy={busy}
            points={points} onPoints={onPoints} notes={notes} onNotes={onNotes}
            onCheckout={onCheckout} />
        ) : null}
      </Stack>
    </Drawer>
  );
}
