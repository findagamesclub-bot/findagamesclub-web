"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { headerHeight, mono, tokens } from "@/lib/tokens";

/**
 * The running total, kept on screen while the unit list scrolls.
 *
 * The case this exists for is somebody building a 2,000 point list on a phone
 * with forty units to scroll past: a total at the top of the page is a total
 * you cannot see at the moment you need it. Sticky under the header rather
 * than fixed to the bottom, so it does not sit on top of the Add button it is
 * reacting to.
 */
export default function PointsBar({
  total, limit, collection,
}: {
  total: number;
  /** 0 for a collection, which cannot be over anything. */
  limit: number;
  collection: boolean;
}) {
  const over = limit > 0 && total > limit;
  const left = limit - total;
  const filled = limit > 0 ? Math.min(100, (total / limit) * 100) : 0;

  return (
    <Box sx={{
      position: "sticky", top: headerHeight, zIndex: 3,
      backgroundColor: tokens.paper, borderRadius: 1.5, p: 2,
      border: `1px solid ${over ? tokens.danger : tokens.rule}`,
    }}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
        <Typography sx={{ fontFamily: mono, fontSize: "1.75rem", fontWeight: 700,
                          lineHeight: 1, color: over ? tokens.danger : tokens.ink }}>
          {collection || limit === 0
            ? total.toLocaleString("en-GB")
            : `${total.toLocaleString("en-GB")} / ${limit.toLocaleString("en-GB")}`}
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.82rem",
                          color: over ? tokens.danger : tokens.inkMuted }}>
          {collection || limit === 0
            ? "points in this collection"
            : over
              ? `${Math.abs(left).toLocaleString("en-GB")} over the limit`
              : `${left.toLocaleString("en-GB")} left`}
        </Typography>
      </Stack>

      {limit > 0 ? (
        <Box sx={{ mt: 1, height: 6, borderRadius: 3,
                   backgroundColor: tokens.surface, overflow: "hidden" }}>
          <Box sx={{ height: "100%", borderRadius: 3, width: `${filled}%`,
                     backgroundColor: over ? tokens.danger : tokens.brass }} />
        </Box>
      ) : null}
    </Box>
  );
}
