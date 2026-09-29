"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ArmyLines from "./ArmyLines";
import { shortDate } from "@/utils/dates";
import type { ArmyVersion } from "@/types/army";
import { mono, tokens } from "@/lib/tokens";

/**
 * One version's units, read-only.
 *
 * A dialog rather than an expander under the row, which is rule 5 of the UI
 * checklist arriving from a new direction: opening a version in place pushed
 * every version below it down the page, so reading v4 moved v3, v2 and v1 out
 * from under the cursor.
 *
 * The body scrolls and there is no pager. A list is capped by its own points
 * limit at a few dozen lines, and a pager inside a dialog is a control that
 * does less than a scrollbar while adding a second thing to operate. The
 * dialog is then the one scroll region on screen, which is the nested-scroll
 * rule the review history already learned.
 */
export default function ArmyVersionUnits({
  version, onClose,
}: {
  /** Null when nothing is open, so the dialog keeps its exit transition. */
  version: ArmyVersion | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const small = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Dialog open={Boolean(version)} onClose={onClose} fullWidth maxWidth="md"
      fullScreen={small} scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack spacing={0.5}>
          <Typography component="span"
            sx={{ fontWeight: 700, fontSize: "1.15rem" }}>
            {version ? `v${version.versionNumber} · ${version.name}` : ""}
          </Typography>
          <Typography component="span"
            sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
            {version
              ? [
                  version.changeSummary || "Edited list details",
                  `${version.totalPoints.toLocaleString("en-GB")} pts`,
                  `${version.units.length} ${version.units.length === 1 ? "line" : "lines"}`,
                  shortDate(version.createdAt),
                ].join(" · ")
              : ""}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <ArmyLines lines={version?.units ?? []} readOnly />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
