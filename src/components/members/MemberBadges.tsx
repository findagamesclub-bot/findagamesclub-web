"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import BadgeChip from "@/components/ui/BadgeChip";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { Badge } from "@/utils/competition-badges";

type Shown = Badge & {
  icon?: string;
  finishes?: { note: string; onDate: string | null }[];
};

/**
 * What a member has, however they got it.
 *
 * Two sources land here and a reader does not care which: a badge the club
 * awarded, which since 0162 includes the length-of-membership ones it gives
 * out nightly, and a competition badge derived from the standings. `BadgeChip`
 * draws both the same way, and a badge with no icon of its own takes the one
 * its tone implies.
 *
 * A podium badge is one row per rank per club (0167), so winning twice does
 * not make a second chip. It used to say "1st place at Oxford Onslaught 5, and
 * 1 more." and the 1 more was unopenable: the other win was on the page, in a
 * different panel, with nothing joining them. The chip carries the count now
 * and opens the list.
 */
export default function MemberBadges({ badges }: { badges: Shown[] }) {
  const small = useMediaQuery("(max-width:599px)");
  const [open, setOpen] = useState<Shown | null>(null);

  if (!badges.length) return null;

  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {badges.map((badge) => {
          const finishes = badge.finishes ?? [];
          return (
            <BadgeChip key={badge.key} label={badge.label} context={badge.context}
              icon={badge.icon} tone={badge.tone}
              count={finishes.length}
              // Only where there is a list to open. A badge earned once says
              // what it is for in its own context line already, and a chip
              // that opens a dialog repeating that line is a press for nothing.
              onOpen={finishes.length > 1 ? () => setOpen(badge) : undefined} />
          );
        })}
      </Stack>

      <Dialog open={open !== null} onClose={() => setOpen(null)}
        fullWidth maxWidth="xs" fullScreen={small}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>
            {open?.label ?? "Badge"}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
            {`Earned ${open?.finishes?.length ?? 0} times.`}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Stack>
            {(open?.finishes ?? []).map((finish) => (
              <Stack key={`${finish.note}-${finish.onDate ?? ""}`}
                direction="row" spacing={1.5}
                sx={{ py: 1.25, alignItems: "baseline",
                      borderBottom: `1px solid ${tokens.rule}` }}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                  {finish.note}
                </Typography>
                {/* Undated on an imported result, where nothing recorded when
                    it happened. Saying nothing beats inventing a day. */}
                {finish.onDate ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                    color: tokens.inkMuted, flexShrink: 0 }}>
                    {shortDate(finish.onDate)}
                  </Typography>
                ) : null}
              </Stack>
            ))}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(null)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
