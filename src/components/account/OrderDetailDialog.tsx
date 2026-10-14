"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import PriceBreakdown from "@/components/ui/PriceBreakdown";
import { shortDate } from "@/utils/dates";
import { formatPounds } from "@/utils/format";
import { display, mono, tokens } from "@/lib/tokens";
import type { MyOrder } from "@/services/myActivity.service";

/**
 * The whole order, lines and all.
 *
 * The client's words: "we do not show the finer details of the order such as
 * sizes ordered, currently you cannot see the full details of your order."
 * The card shows three lines and counts the rest, which is right for a grid
 * and useless for checking what you actually ordered.
 *
 * A dialog rather than growing the card, because the cards sit three across
 * and one of them opening stretches its whole row. Same call rule 5 made
 * about editing.
 */
export default function OrderDetailDialog({
  order, open, onClose,
}: {
  order: MyOrder;
  open: boolean;
  onClose: () => void;
}) {
  const fullScreen = useMediaQuery("(max-width:600px)");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
          Your order
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", letterSpacing: "0.06em",
                          color: tokens.inkMuted, mt: 0.5 }}>
          {`${order.club.name.toUpperCase()} · ORDERED ${
            (shortDate(order.placedAt) ?? "").toUpperCase()}`}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack>
            {order.items.map((item) => (
              <Stack key={item.id} direction="row" spacing={1.5}
                sx={{ py: 1, alignItems: "flex-start",
                      "&:not(:last-of-type)": {
                        borderBottom: `1px solid ${tokens.rule}` } }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", color: tokens.brass,
                                  fontWeight: 700, flexShrink: 0, minWidth: 28 }}>
                  {`${item.quantity}×`}
                </Typography>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                  {/* The size, which has been written onto the line since 0088
                      and shown nowhere. It is the first thing somebody checks. */}
                  {item.variantLabel ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                      letterSpacing: "0.06em", color: tokens.inkMuted }}>
                      {item.variantLabel.toUpperCase()}
                    </Typography>
                  ) : null}
                  {!item.quoted && item.quantity > 1 && item.unitAmount > 0 ? (
                    <Typography sx={{ fontSize: "0.75rem", fontFamily: display,
                                      color: tokens.inkMuted }}>
                      {`${formatPounds(item.unitAmount)} each`}
                    </Typography>
                  ) : null}
                </Box>

                <Typography sx={{ fontFamily: mono, flexShrink: 0,
                                  fontSize: item.quoted ? "0.72rem" : "0.84rem",
                                  color: item.quoted ? tokens.inkMuted : undefined }}>
                  {item.quoted ? "To be priced" : formatPounds(item.grossTotal)}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <PriceBreakdown priced={order.priced} labels={{ total: "Total" }} />

          {order.notes ? (
            <Box>
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                letterSpacing: "0.06em", color: tokens.inkMuted, mb: 0.5 }}>
                WHAT YOU TOLD THE CLUB
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {order.notes}
              </Typography>
            </Box>
          ) : null}

          <Typography sx={{ fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
                            color: tokens.inkMuted }}>
            The club confirms the price and arranges payment with you directly.
            Nothing is charged here.
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
