import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { matGrid, metalOf, tokens } from "@/lib/tokens";

/**
 * A loyalty tier, as a struck plate.
 *
 * The one place in the app where colour means rank rather than identity. It is
 * a plate rather than a badge because a badge is something you are given and a
 * plate is something that gets engraved — which is what a points ladder is.
 */
export default function MetalPlate({
  label, tone, points, size = "large",
}: {
  label: string;
  tone: string;
  /** Lifetime points, set in mono under the name. */
  points?: number;
  size?: "large" | "small";
}) {
  const metal = metalOf(tone);
  const large = size === "large";

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 1,
        px: large ? 2.5 : 1.5,
        py: large ? 1.75 : 0.9,
        minWidth: large ? 150 : 0,
        backgroundImage: `linear-gradient(135deg, ${metal.deep} 0%, ${metal.base} 55%, ${metal.deep} 100%)`,
        border: `1px solid ${metal.deep}`,
      }}
    >
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: matGrid(0.07) }} />
      {/* A single raking highlight, so the plate reads as struck metal rather
          than as a rectangle filled with a gradient. */}
      <Box aria-hidden sx={{ position: "absolute", inset: 0,
                             background: "linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.18) 50%, transparent 58%)" }} />

      <Stack spacing={large ? 0.4 : 0} sx={{ position: "relative" }}>
        <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800,
                          fontSize: large ? "1.15rem" : "0.78rem", lineHeight: 1.1,
                          color: "#FFFFFF", letterSpacing: "0.01em" }}>
          {label}
        </Typography>
        {points !== undefined ? (
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: large ? "0.72rem" : "0.62rem",
                            letterSpacing: "0.1em", color: "rgba(255,255,255,0.82)" }}>
            {points.toLocaleString("en-GB")} LIFETIME
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

/** The bar between one tier and the next. Brass on the club's own ground. */
export function ProgressRule({ value, tone }: { value: number; tone: string }) {
  const metal = metalOf(tone);
  return (
    <Box sx={{ height: 4, borderRadius: 2, backgroundColor: tokens.rule, overflow: "hidden" }}>
      <Box sx={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height: "100%",
                 backgroundColor: metal.base, transition: "width 420ms ease" }} />
    </Box>
  );
}
