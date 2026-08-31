import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MAP_HINT } from "./mapSurface";
import { tokens } from "@/lib/tokens";

/** The line above every map: what is on it, and how to move it. */
export default function MapHint({ children }: { children?: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2}
      sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem",
                        color: tokens.inkMuted }}>
        {children}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                        color: tokens.inkMuted, flexShrink: 0 }}>
        {MAP_HINT}
      </Typography>
    </Stack>
  );
}
