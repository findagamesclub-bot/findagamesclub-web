import Box from "@mui/material/Box";
import { tokens } from "@/lib/tokens";
import { readinessFields } from "@/utils/listing-readiness";
import type { Check } from "@/utils/listing-readiness";

/**
 * The listing, one block per field it asks for.
 *
 * Grouped by check with a gap between groups, so the gaps in the bar sit under
 * the heading that owns them: a club can see it is one box short of finished
 * and which box, without reading seven rows. Same blocks as the table meter on
 * a club night, and the same two cues rather than one, filled blocks being
 * taller as well as darker so the count survives greyscale.
 */
export default function HealthBar({ checks }: { checks: Check[] }) {
  const { done, total } = readinessFields(checks);

  return (
    <Box role="img" aria-label={`${done} of ${total} fields filled`}
      sx={{ display: "flex", gap: "7px", alignItems: "flex-end" }}>
      {checks.map((check) => (
        <Box key={check.key} sx={{ display: "flex", gap: "3px" }}>
          {Array.from({ length: check.total }, (_, i) => (
            <Box key={i} aria-hidden sx={{
              width: 10, borderRadius: "2px",
              height: i < check.done ? 20 : 13,
              backgroundColor: i < check.done ? tokens.brass : "#C9D3E0",
            }} />
          ))}
        </Box>
      ))}
    </Box>
  );
}
