import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";
import PageHead from "@/components/ui/PageHead";
import NotificationSettings from "@/components/account/NotificationSettings";
import { getCurrentProfile } from "@/services/auth.service";
import { getMySettings } from "@/services/notificationPrefs.service";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Email settings" };

/**
 * Which emails this member wants.
 *
 * Grouped into six families rather than listed as forty-five kinds, because a
 * screen with forty-five switches is a screen nobody finishes. Each card says
 * how many notifications its switch governs, so the grouping is visible rather
 * than something to take on trust.
 */
export default async function NotificationsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/notifications");

  const settings = await getMySettings();

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <PageHead
        title="Email settings"
        lede="Choose what reaches your inbox. Changes save as you make them."
      />

      {/* Said once, here, rather than as a second column of switches that do
          nothing: turning email off must not cost somebody the record of what
          happened, and this is the sentence that promises it. */}
      <Stack direction="row" spacing={1.5}
        sx={{
          mb: 3, p: 2, alignItems: "flex-start",
          border: `1px solid ${tokens.rule}`, borderRadius: 1,
          backgroundColor: tokens.surface,
        }}>
        <NotificationsIcon aria-hidden sx={{ fontSize: 20, color: tokens.brass, mt: "2px" }} />
        <Typography sx={{ fontSize: "0.92rem", lineHeight: 1.6, color: tokens.inkMuted }}>
          Your notification bell keeps everything either way. These switches
          decide what also arrives by email, so turning one off never costs you
          the record of what happened.
        </Typography>
      </Stack>

      <NotificationSettings settings={settings} />
    </Box>
  );
}
