import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Messages" };

/**
 * The right-hand pane with nothing open yet.
 *
 * On a phone this never shows — the shell gives the whole screen to the rail
 * at this route, and the rail is the page.
 */
export default function MessagesPage() {
  return (
    <Stack spacing={1.25}
      sx={{ height: "100%", alignItems: "center", justifyContent: "center",
            px: 4, py: 6, textAlign: "center" }}>
      <ForumIcon sx={{ fontSize: 40, color: tokens.rule }} />
      <Typography variant="h3" sx={{ fontSize: "1.15rem" }}>Pick a conversation</Typography>
      <Typography variant="body2" sx={{ color: tokens.inkMuted, maxWidth: 320 }}>
        Everybody you share a club with is on the left. Conversations are per
        club, so the same person appears once for each club you both belong to.
      </Typography>
    </Stack>
  );
}
