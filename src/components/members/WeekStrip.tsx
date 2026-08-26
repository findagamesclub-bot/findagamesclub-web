import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";

const DAYS = [
  ["Monday", "Mo"], ["Tuesday", "Tu"], ["Wednesday", "We"], ["Thursday", "Th"],
  ["Friday", "Fr"], ["Saturday", "Sa"], ["Sunday", "Su"],
] as const;

/**
 * The seven nights, with the ones this person is free filled in.
 *
 * The page's real job is answering "could we get a game, and when", and a list
 * of day chips makes you read every one to work that out. A week you can see
 * the shape of answers it without reading. Two letters rather than one, because
 * T and S are each two different days.
 */
export default function WeekStrip({
  available, id, name, size = "medium",
}: {
  available: string[];
  id: string;
  name: string;
  size?: "small" | "medium";
}) {
  const { faction } = clubIdentity(id, name);
  const free = new Set(available.map((d) => d.toLowerCase()));
  // Seven cells have to hold one line at 390px, or the week stops reading as a
  // week. Seven times 40 plus the gaps just fits inside a padded panel.
  const cell = size === "medium" ? { xs: 40, sm: 44 } : { xs: 34, sm: 36 };

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "nowrap" }}>
      {DAYS.map(([day, short]) => {
        const on = free.has(day.toLowerCase());
        return (
          <Box
            key={day}
            // Screen readers get the day and the answer, not two letters.
            aria-label={`${day}: ${on ? "usually free" : "not free"}`}
            sx={{
              display: "grid",
              placeItems: "center",
              width: cell,
              height: cell,
              flexShrink: 0,
              borderRadius: "3px",
              fontFamily: "var(--font-display)",
              fontSize: size === "medium" ? "0.85rem" : "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              backgroundColor: on ? faction.base : tokens.surface,
              color: on ? "#FFFFFF" : "#9AA8BC",
              border: `1px solid ${on ? faction.base : tokens.rule}`,
            }}
          >
            {short}
          </Box>
        );
      })}
    </Stack>
  );
}
