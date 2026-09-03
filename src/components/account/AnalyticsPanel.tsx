import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MonoLabel from "@/components/ui/MonoLabel";
import { display, tokens } from "@/lib/tokens";

/**
 * One panel of the dashboard analytics.
 *
 * Eyebrow, heading, then the thing itself. Six panels of the same shape read
 * as one instrument; six panels each inventing their own heading read as six
 * screenshots pasted together, which is what the client was comparing us
 * against in the first place.
 */
export default function AnalyticsPanel({
  eyebrow, title, children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack component="section" spacing={1.5}
      sx={{ p: 2.25, border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
            backgroundColor: tokens.paper, height: "100%" }}>
      <Stack spacing={0.25}>
        <MonoLabel mb={0}>{eyebrow}</MonoLabel>
        <Typography component="h3"
          sx={{ fontFamily: display, fontWeight: 800, fontSize: "1.02rem",
                lineHeight: 1.2, color: tokens.ink }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Stack>
  );
}
