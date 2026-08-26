"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import MetalPlate, { ProgressRule } from "@/components/ui/MetalPlate";
import LoyaltyLedger from "./LoyaltyLedger";
import { tokens } from "@/lib/tokens";
import type { LoyaltyEntry } from "@/types/loyalty";

/**
 * One member's loyalty, opened from their card on the roster.
 *
 * A dialog rather than a page: an owner working down a roster of ten is
 * comparing people, and a round trip per member loses their place in the list.
 * The data is already loaded with the roster, so opening this fetches nothing.
 */
export default function MemberLoyaltyButton({
  name, tier, tone, lifetime, available, toNext, nextTier, progress, entries,
}: {
  name: string;
  tier: string;
  tone: string;
  lifetime: number;
  available: number;
  toNext: number | null;
  nextTier: string | null;
  progress: number;
  entries: LoyaltyEntry[];
}) {
  const [open, setOpen] = useState(false);
  const fullScreen = useMediaQuery("(max-width:600px)");

  return (
    <>
      <Button size="small" variant="text" onClick={() => setOpen(true)}
        sx={{ p: 0, minWidth: 0, fontSize: "0.72rem", textTransform: "none",
              color: tokens.inkMuted, "&:hover": { background: "none", color: tokens.ink } }}>
        See points
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <DialogTitle sx={{ pr: 6 }}>
          {name}
          <IconButton onClick={() => setOpen(false)} aria-label="Close"
            sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <MetalPlate label={tier} tone={tone} />
              <Stack direction="row" spacing={3} sx={{ alignItems: "baseline" }}>
                <Figure value={available} label="to spend" emphasis />
                <Figure value={lifetime} label="earned all time" />
              </Stack>
            </Stack>

            {nextTier ? (
              <Stack spacing={0.75}>
                <ProgressRule value={progress} tone={tone} />
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  <Box component="span" sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                              color: tokens.ink }}>
                    {toNext}
                  </Box>{" "}
                  more to {nextTier}.
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Top of the ladder.
              </Typography>
            )}

            <Box>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                letterSpacing: "0.12em", color: tokens.inkMuted, mb: 1 }}>
                HOW IT ADDS UP
              </Typography>
              <LoyaltyLedger entries={entries} />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Figure({ value, label, emphasis }: { value: number; label: string; emphasis?: boolean }) {
  return (
    <Stack direction="row" spacing={0.8} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.45rem", fontWeight: 700,
                        lineHeight: 1, color: emphasis ? tokens.brass : tokens.ink }}>
        {value.toLocaleString("en-GB")}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
