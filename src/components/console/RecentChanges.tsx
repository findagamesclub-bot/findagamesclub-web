import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Pager from "@/components/ui/Pager";
import { display, mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import type { TeamChange } from "@/services/clubTeam.service";

/**
 * What has changed at this club lately, and who did it.
 *
 * The first question after "why does the listing say that" is "who changed
 * it", and until now nothing recorded the answer. Server-paged from the start:
 * this grows for ever and a club that has been running two years should not
 * load two years of it to show twenty rows.
 */
export default function RecentChanges({
  changes, page, total, perPage, basePath,
}: {
  changes: TeamChange[];
  page: number;
  total: number;
  perPage: number;
  basePath: string;
}) {
  if (total === 0) {
    return (
      <Box sx={{ px: 2, py: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                 backgroundColor: tokens.paper }}>
        <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 600 }}>
          Nothing has changed yet
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.5 }}>
          Edits to the club, and changes to who runs it, are listed here.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        {changes.map((change) => (
          <Stack key={change.id} direction="row" spacing={1.5}
            sx={{ alignItems: "baseline", px: 2, py: 1.25, borderRadius: 1.5,
                  border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                  flexWrap: "wrap", rowGap: 0.25 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                              letterSpacing: "0.08em", color: tokens.inkMuted,
                              flexShrink: 0, minWidth: 68 }}>
              {(shortDate(change.at) ?? "").toUpperCase()}
            </Typography>
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.92rem" }}>
              {change.summary}
            </Typography>
            <Typography variant="body2"
              sx={{ color: tokens.inkMuted, fontSize: "0.82rem", flexShrink: 0 }}>
              {change.actor}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Pager page={page} total={total} size={perPage} noun="changes"
        href={{ path: basePath, params: {} }} />
    </Stack>
  );
}
