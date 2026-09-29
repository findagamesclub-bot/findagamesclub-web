"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import type { DetachmentRow } from "@/services/armyCatalogue.service";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * A faction's detachments, each carrying its own dispositions.
 *
 * The dispositions sit inside the detachment rather than in a list of their
 * own, which is the legacy manifest's stated policy and what makes a
 * disposition from another detachment unofferable rather than merely refused.
 *
 * No pager: a faction has a handful, and the 346 in the catalogue are spread
 * across 30 factions.
 */
export default function DetachmentGrid({
  detachments, frozen, onEdit,
}: {
  detachments: DetachmentRow[];
  frozen: boolean;
  onEdit: (one: DetachmentRow) => void;
}) {
  return (
    <>
        {detachments.length === 0 ? (
          <EmptyState title="No detachments yet"
            description="A detachment carries its own dispositions, so a member picking one is only ever offered that detachment's." />
        ) : (
          <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                     gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                            sm: "repeat(2, minmax(0, 1fr))",
                                            lg: "repeat(3, minmax(0, 1fr))" } }}>
            {detachments.map((one) => (
              <Stack key={one.id} spacing={1.25}
                sx={{ height: "100%", p: 2, borderRadius: 1.5,
                      border: `1px solid ${tokens.rule}`,
                      backgroundColor: tokens.paper }}>
                <Typography sx={{ fontFamily: display, fontWeight: 700,
                                  fontSize: "0.98rem" }}>
                  {one.label}
                </Typography>
                <Stack direction="row" spacing={0.75} useFlexGap
                  sx={{ flexWrap: "wrap" }}>
                  {one.dispositions.length ? one.dispositions.map((d) => (
                    <StatusChip key={d} label={d} marker />
                  )) : (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                      color: tokens.inkMuted }}>
                      No dispositions
                    </Typography>
                  )}
                </Stack>
                <Box sx={{ flex: 1 }} />
                {frozen ? null : (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button variant="text" size="small"
                      onClick={() => onEdit(one)}>
                      Edit
                    </Button>
                  </Stack>
                )}
              </Stack>
            ))}
          </Box>
        )}
    </>
  );
}
