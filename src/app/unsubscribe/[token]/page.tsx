import type { Metadata } from "next";
import Box from "@mui/material/Box";
import UnsubscribePanel from "@/components/account/UnsubscribePanel";
import { readUnsubscribe } from "@/services/notificationPrefs.service";
import { FAMILY_META } from "@/utils/notification-families";

export const metadata: Metadata = {
  title: "Unsubscribe",
  // Nothing here should ever appear in a search result.
  robots: { index: false, follow: false },
};

/**
 * Stopping one kind of email without signing in.
 *
 * Signed out on purpose: an unsubscribe link that leads to a login screen is
 * the thing that makes people press the spam button instead.
 *
 * The press is a POST, not this page load. Mail clients and link scanners
 * fetch URLs in emails before anybody reads them, so a GET that unsubscribed
 * would turn a security scanner into a preference change.
 */
export default async function UnsubscribePage({
  params,
}: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  const found = await readUnsubscribe(token).catch(() => null);

  return (
    <Box component="main" sx={{ maxWidth: 560, mx: "auto", px: 2, py: { xs: 6, md: 10 } }}>
      <UnsubscribePanel
        token={token}
        label={found ? FAMILY_META[found.family].label : null}
        detail={found ? FAMILY_META[found.family].detail : null}
        alreadyOff={found?.alreadyOff ?? false}
      />
    </Box>
  );
}
