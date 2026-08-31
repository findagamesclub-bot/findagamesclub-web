"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useActionToast } from "@/components/ui/Toaster";
import { linkNameAction, type LinkState } from "@/app/clubs/[slug]/results/actions";
import { display, mono, tokens } from "@/lib/tokens";
import type { MatchedName } from "@/services/memberRecords.service";

/**
 * Results already attached to somebody, and the way to take one back.
 *
 * Without this a wrong pick is permanent from the club's side: the row leaves
 * the unmatched list and there is no other route to it. Folded away by
 * default, because the job on this page is the ones still waiting.
 */
export default function MatchedList({
  rows, slug,
}: {
  rows: MatchedName[];
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, submit, busy] = useActionState<LinkState, FormData>(linkNameAction, {});
  useActionToast(state);

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", mb: 1.5 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.12em", color: tokens.inkMuted }}>
          {`ALREADY MATCHED · ${rows.length}`}
        </Typography>
        <Button size="small" variant="text" onClick={() => setOpen((was) => !was)}
          sx={{ minWidth: 0, fontSize: "0.78rem" }}>
          {open ? "Hide" : "Show"}
        </Button>
      </Stack>

      {open ? (
        <Box sx={{ borderRadius: 2, overflow: "hidden",
                   border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
          {rows.map((row, i) => (
            <Stack key={`${row.kind}-${row.id}`} component="form" action={submit}
              direction={{ xs: "column", sm: "row" }} spacing={1.5}
              sx={{ px: 2.25, py: 1.5, alignItems: { sm: "center" },
                    borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}` }}>
              <input type="hidden" name="kind" value={row.kind} />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="slug" value={slug} />
              {/* Empty profile id is what detaches it. */}
              <input type="hidden" name="profileId" value="" />

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography sx={{ fontFamily: display, fontWeight: 700 }}>
                    {row.name}
                  </Typography>
                  <Typography sx={{ color: tokens.inkMuted }}>→</Typography>
                  <Typography sx={{ fontFamily: display, fontWeight: 700,
                                    color: tokens.brand }}>
                    {row.memberName}
                  </Typography>
                  <Chip size="small" label={row.kind === "standing" ? "League" : "Event"}
                    sx={{ height: 18, fontSize: "0.58rem", bgcolor: tokens.surface }} />
                </Stack>
                <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                                  color: tokens.inkMuted }} noWrap>
                  {`${row.context.toUpperCase()} · ${row.detail.toUpperCase()}`}
                </Typography>
              </Box>

              <Button type="submit" size="small" variant="text" loading={busy}
                sx={{ color: tokens.danger, flexShrink: 0 }}>
                Unmatch
              </Button>
            </Stack>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
