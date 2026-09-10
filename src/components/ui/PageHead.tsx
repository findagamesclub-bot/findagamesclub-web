import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";

/**
 * The same heading block on every page of an app shell: the member's account,
 * a club's console, the admin console. They read as one place because it is
 * one component rather than three that drifted.
 */
export default function PageHead({
  title, lede, action,
}: {
  title: string;
  lede?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack direction="row" spacing={2}
      sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.1rem" } }}>
          {title}
        </Typography>
        {lede ? (
          <Typography variant="body1" sx={{ color: tokens.inkMuted, maxWidth: 720 }}>
            {lede}
          </Typography>
        ) : null}
      </Stack>
      {action}
    </Stack>
  );
}
