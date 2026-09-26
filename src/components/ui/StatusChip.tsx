import Chip from "@mui/material/Chip";
import type { StatusTone } from "@/utils/moderation-status";
import { tokens } from "@/lib/tokens";

const TONES: Record<StatusTone, string> = {
  waiting: tokens.brass,
  down: tokens.danger,
  kept: tokens.positive,
  quiet: tokens.inkMuted,
};

/**
 * One status tag for the whole app.
 *
 * Filled, white label, 0.68rem, bold: the treatment the admin lists settled on.
 * A second copy of that in another file is a copy that drifts the first time
 * either one is touched, which is exactly what happened between the moderation
 * queues and the member's own reports.
 *
 * `marker` is the quieter second tag that qualifies the first ("Words are
 * gone"), outlined so it never competes with the status it sits beside.
 */
export default function StatusChip({
  label, tone, marker = false,
}: {
  label: string;
  tone?: StatusTone;
  /** An outlined qualifier rather than a status of its own. */
  marker?: boolean;
}) {
  if (marker) {
    return (
      <Chip size="small" variant="outlined" label={label}
        sx={{ fontSize: "0.68rem", borderColor: tokens.rule }} />
    );
  }
  return (
    <Chip size="small" label={label}
      sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#FFFFFF",
            bgcolor: TONES[tone ?? "quiet"] }} />
  );
}
