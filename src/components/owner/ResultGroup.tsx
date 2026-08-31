"use client";

import { useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import OwnerResultRow from "./OwnerResultRow";
import Pager from "@/components/ui/Pager";
import { usePagedList } from "@/hooks/usePagedList";
import { tokens } from "@/lib/tokens";
import type { OwnerResult } from "@/services/ownerBookings.service";

/**
 * One band of the score queue, paged on its own.
 *
 * Each band answers a different question, so they page separately: a club with
 * four hundred settled games should not push its two disputes onto page nine.
 */
export default function ResultGroup({
  title, note, rows, edge, onOpen,
}: {
  title: string;
  note: string;
  rows: OwnerResult[];
  edge: string | null;
  onOpen: (result: OwnerResult) => void;
}) {
  const top = useRef<HTMLDivElement>(null);
  const paged = usePagedList(rows, 12, top);

  return (
    <Box>
      <Typography variant="h3" sx={{ fontSize: "1.05rem", mb: 0.25 }}>
        {title}
        <Box component="span" sx={{ color: tokens.inkMuted, fontWeight: 400 }}>
          {` · ${rows.length}`}
        </Box>
      </Typography>
      <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 1.5 }}>
        {note}
      </Typography>

      <Stack ref={top} spacing={1}>
        {paged.shown.map((row) => (
          <OwnerResultRow key={row.id} result={row} edge={edge} onOpen={onOpen} />
        ))}
      </Stack>

      {rows.length > 12 ? (
        <Pager page={paged.page} total={paged.total} noun="games" size={12}
          onChange={paged.goTo} />
      ) : null}
    </Box>
  );
}
