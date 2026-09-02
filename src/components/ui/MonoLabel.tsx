import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

/**
 * The small condensed caption above a block.
 *
 * Six components had their own copy of these four lines and they had already
 * started to drift on letter spacing, which is exactly the sort of thing that
 * makes a page look assembled rather than designed.
 */
export default function MonoLabel({
  children, mb = 1.25,
}: {
  children: React.ReactNode;
  mb?: number;
}) {
  return (
    <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                      letterSpacing: "0.12em", color: tokens.inkMuted, mb }}>
      {String(children).toUpperCase()}
    </Typography>
  );
}
