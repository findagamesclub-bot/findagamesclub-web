import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { tokens } from "@/lib/tokens";

/**
 * What this is, and what it is not.
 *
 * Under every generated card, in the same words every time. It says three
 * things deliberately: where the evidence came from, that it can be wrong, and
 * that it does not know the rules. The third is the one that matters, because
 * the prompts forbid the model from inventing rules and it will do it anyway.
 */
export default function AiDisclaimer() {
  return (
    <Stack direction="row" spacing={1.25}
      sx={{ alignItems: "flex-start", pt: 1.5,
            borderTop: `1px solid ${tokens.rule}` }}>
      <InfoOutlinedIcon sx={{ fontSize: 17, color: tokens.inkMuted, mt: 0.25 }} />
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Built only from what this club has recorded. It can be wrong and it does
        not know the rules, so check unit names and interactions against your codex.
      </Typography>
    </Stack>
  );
}
