import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { clubIdentity } from "@/utils/club-identity";
import { mono, tokens } from "@/lib/tokens";
import type { ClubSession } from "@/types/club";

type Props = { schedule: ClubSession[]; slug: string; name: string };

/**
 * Meeting nights as day plates rather than run-together text.
 *
 * "Tuesday 18:30 - 22:00 · Hosted teach-and-play" on one line makes the reader
 * find the day inside a sentence. Splitting the day out means you can scan the
 * left edge for the night you're free.
 */
export default function ScheduleList({ schedule, slug, name }: Props) {
  const { faction } = clubIdentity(slug, name);

  return (
    <Stack spacing={0.75}>
      {schedule.map((session, i) => (
        <Stack key={`${session.day}-${session.time}-${i}`} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              flexShrink: 0,
              minWidth: 42,
              textAlign: "center",
              backgroundColor: faction.soft,
              color: faction.deep,
              border: `1px solid ${faction.base}33`,
              borderRadius: "3px",
              fontFamily: "var(--font-display)",
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              px: 0.75,
              py: 0.5,
            }}
          >
            {session.day.slice(0, 3)}
          </Box>
          <Box sx={{ minWidth: 0, pt: 0.125 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.92rem", color: tokens.ink, lineHeight: 1.45 }}>
              {session.time}
            </Typography>
            {session.label ? (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                {session.label}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
