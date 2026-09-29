import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";

/**
 * Where this answer came from.
 *
 * Model, when, and what it was about. Provenance rather than decoration: the
 * same list coached twice a week apart by two different models are two
 * different answers, and somebody comparing them needs to know which is which.
 */
export default function AiResultHeader({
  model, at, about, action,
}: {
  model: string;
  at: string;
  /** "Custodes League List v3", "against Aeldari". */
  about: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.5}
      sx={{ alignItems: "baseline", justifyContent: "space-between",
            flexWrap: "wrap" }} useFlexGap>
      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
        {[model || "Generated", shortDate(at), about].filter(Boolean).join(" · ")}
      </Typography>
      {action}
    </Stack>
  );
}
