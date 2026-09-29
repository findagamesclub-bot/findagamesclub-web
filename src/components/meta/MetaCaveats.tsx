"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";
import { META_CAVEATS } from "@/utils/meta-takeaways";
import { tokens } from "@/lib/tokens";

/**
 * What this data cannot tell you.
 *
 * Legacy shows six of these and they are the honest half of the page: every
 * one is a limit on what the numbers mean. At the top rather than the bottom,
 * because somebody meeting the tracker for the first time needs them before
 * they read a win rate, not after a scroll past thirty cards. In a dialog
 * rather than an expander, because six paragraphs opening inline pushed the
 * rankings a screen and a half down (rule 5, and the same reason the listing
 * history moved into one).
 */
export default function MetaCaveats() {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="small" variant="text" onClick={() => setOpen(true)}
        startIcon={<HelpOutlineIcon sx={{ fontSize: 17 }} />}
        sx={{ color: tokens.brand, alignSelf: "flex-start" }}>
        How to read this
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"
        fullScreen={fullScreen}>
        <DialogTitle sx={{ fontSize: "1.2rem" }}>
          How to read this
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Six things the numbers above cannot tell you.
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Stack component="ol" spacing={1.5}
            sx={{ pl: 2.5, m: 0, "& li": { color: tokens.inkMuted } }}>
            {META_CAVEATS.map((line) => (
              <Typography key={line} component="li" variant="body2">
                {line}
              </Typography>
            ))}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
