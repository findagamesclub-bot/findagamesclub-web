import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * What has been done TO this account, and by whom.
 *
 * Lifted off the page when 0190 gave it three more panels to compose: a page
 * reads like a table of contents or it stops being one.
 */

const WORDS: Record<string, string> = {
  suspended: "Suspended",
  restored: "Restored",
  made_admin: "Made a site admin",
  removed_admin: "Admin access removed",
};

export type AccountEvent = {
  id: number;
  action: string;
  reason: string;
  actor: string;
  at: string;
};

export default function AccountHistory({ history }: { history: AccountEvent[] }) {
  if (!history.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing has been done to this account.
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5}>
      {history.map((entry) => (
        <Stack key={entry.id} direction="row" spacing={1.5}
          sx={{ alignItems: "baseline", px: 2, py: 1.25, borderRadius: 1.5,
                border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                flexWrap: "wrap", rowGap: 0.25 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                            letterSpacing: "0.08em", color: tokens.inkMuted,
                            minWidth: 68, flexShrink: 0 }}>
            {(shortDate(entry.at) ?? "").toUpperCase()}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.92rem" }}>
              {WORDS[entry.action] ?? entry.action}
            </Typography>
            {entry.reason ? (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {entry.reason}
              </Typography>
            ) : null}
          </Box>
          <Typography variant="body2"
            sx={{ color: tokens.inkMuted, fontSize: "0.82rem", flexShrink: 0 }}>
            {entry.actor}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
