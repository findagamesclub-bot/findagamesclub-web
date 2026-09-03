import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

const FACE = {
  won: { letter: "W", bg: tokens.positive, label: "Won" },
  drew: { letter: "D", bg: tokens.inkMuted, label: "Drew" },
  lost: { letter: "L", bg: tokens.danger, label: "Lost" },
} as const;

/**
 * The run of results, oldest on the left.
 *
 * A record of 3-1-2 says what happened; it does not say whether the member is
 * on the way up or the way down, which is the thing anybody actually wants to
 * know from their own dashboard. Six squares say it in one glance.
 *
 * Each square carries its letter as well as its colour, so it still reads
 * without the green and the red.
 */
export default function FormGuide({
  results, note, size = "large",
}: {
  results: ("won" | "drew" | "lost")[];
  /** Null hides it, for a tile that has already said what it is showing. */
  note?: string | null;
  size?: "small" | "large";
}) {
  const box = size === "small" ? 17 : 24;
  if (!results.length) {
    return size === "small" ? null : (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Your run of results appears here once a game has been scored.
      </Typography>
    );
  }

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
        {results.map((outcome, i) => {
          const face = FACE[outcome];
          return (
            <Box key={i} title={face.label}
              sx={{ width: box, height: box, borderRadius: 0.75, flexShrink: 0,
                    display: "grid", placeItems: "center",
                    backgroundColor: face.bg,
                    // The newest result is the one being read for; a ring round
                    // it stops the eye counting squares to find the end.
                    ...(i === results.length - 1
                      ? { boxShadow: `0 0 0 2px ${tokens.paper}, 0 0 0 3.5px ${face.bg}` }
                      : {}) }}>
              <Typography sx={{ fontFamily: mono, fontWeight: 700,
                                fontSize: size === "small" ? "0.56rem" : "0.68rem",
                                color: "#FFFFFF", lineHeight: 1 }}>
                {face.letter}
              </Typography>
            </Box>
          );
        })}
      </Stack>
      {note === null ? null : (
        <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.08em",
                          color: tokens.inkMuted }}>
          {(note ?? "OLDEST LEFT, LATEST RIGHT").toUpperCase()}
        </Typography>
      )}
    </Stack>
  );
}
