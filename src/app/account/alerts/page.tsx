import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/account/PageHead";
import AlertList from "@/components/account/AlertList";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyAlerts } from "@/services/eventAlerts.service";

export const metadata = { title: "Your event alerts" };

/**
 * The searches this member asked to be told about.
 *
 * They can be made and re-run from the events page; this is where they can be
 * read as a list and thrown away, which the events page has no room for.
 */
export default async function AccountAlertsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/alerts");

  const alerts = await getMyAlerts(viewer.id);

  return (
    // Same column as the tickets and the bookings, so the three read as one
    // place rather than three widths.
    <Box sx={{ maxWidth: 880, mx: "auto" }}>
      <PageHead
        title="Event alerts"
        lede={alerts.length
          ? `${alerts.length} saved search${alerts.length === 1 ? "" : "es"}. We watch for events that match.`
          : "Save a search on the events page and it lands here."}
      />

      {alerts.length ? (
        <AlertList alerts={alerts} />
      ) : (
        <EmptyState
          title="No alerts saved"
          description="Filter the events page to what you want, then save it. Matching events will find you."
          action={{ label: "Browse events", href: "/events" }}
        />
      )}
    </Box>
  );
}
