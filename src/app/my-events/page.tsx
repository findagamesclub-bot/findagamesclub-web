import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import EventIcon from "@mui/icons-material/Event";
import HistoryIcon from "@mui/icons-material/History";
import Section from "@/components/ui/Section";
import EmptyState from "@/components/ui/EmptyState";
import OwnerEventRow from "@/components/owner/OwnerEventRow";
import { getCurrentProfile } from "@/services/auth.service";
import { getOwnerEvents } from "@/services/ownerEvents.service";
import { formatMoney } from "@/utils/format";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "My events" };

/** Past events run to years. Three is a reminder; the rest live per club. */
const SHOW_PAST = 3;

export default async function MyEventsPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/my-events");

  const { upcoming, past, clubCount, totals } = await getOwnerEvents(viewer.id);
  const anyEvents = upcoming.length + past.length > 0;

  const counts = [
    { label: "coming up", value: String(upcoming.length), emphasis: upcoming.length > 0 },
    ...(totals.tickets
      ? [
          { label: totals.tickets === 1 ? "ticket sold" : "tickets sold", value: String(totals.tickets) },
          { label: "due on the door", value: formatMoney(totals.due) },
        ]
      : []),
  ];

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography variant="overline" sx={{ color: tokens.inkMuted }}>Your account</Typography>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.4rem" } }}>My events</Typography>
      </Stack>

      {clubCount === 0 ? (
        <Box sx={{ mt: 3 }}>
          <EmptyState
            title="You do not run a club"
            description="Events at clubs you run appear here. Tickets you have bought are under My tickets."
            action={{ label: "Browse the directory", href: "/clubs" }}
          />
        </Box>
      ) : (
        <>
          <Stack direction="row" spacing={{ xs: 2.5, sm: 4 }} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "baseline", mb: 1 }}>
            {counts.map((c) => (
              <Stack key={c.label} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "1.45rem",
                                  fontWeight: 700, lineHeight: 1,
                                  color: c.emphasis ? tokens.brass : tokens.ink }}>
                  {c.value}
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                  letterSpacing: "0.1em", color: tokens.inkMuted }}>
                  {c.label.toUpperCase()}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 3 }}>
            {anyEvents
              ? `Across ${clubCount === 1 ? "your club" : `your ${clubCount} clubs`}. Figures count reserved bookings only.`
              : `Nothing scheduled at ${clubCount === 1 ? "your club" : `any of your ${clubCount} clubs`} yet.`}
          </Typography>

          {upcoming.length ? (
            <Section title="Coming up" icon={EventIcon}>
              <Stack spacing={1.5}>
                {upcoming.map((e) => <OwnerEventRow key={e.id} event={e} />)}
              </Stack>
            </Section>
          ) : anyEvents ? (
            <EmptyState
              title="Nothing coming up"
              description="Every event you run has already happened. The most recent are below."
            />
          ) : null}

          {past.length ? (
            <Section title="Already run" icon={HistoryIcon}
              action={
                past.length > SHOW_PAST ? (
                  <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                    {SHOW_PAST} of {past.length}
                  </Typography>
                ) : undefined
              }>
              <Stack spacing={1.5}>
                {past.slice(0, SHOW_PAST).map((e) => <OwnerEventRow key={e.id} event={e} />)}
              </Stack>
              {past.length > SHOW_PAST ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 2 }}>
                  A club&rsquo;s full history is on its own events page, from{" "}
                  <NextLink href="/my-clubs" style={{ color: tokens.brand, fontWeight: 600 }}>
                    My clubs
                  </NextLink>
                  .
                </Typography>
              ) : null}
            </Section>
          ) : null}
        </>
      )}
    </Container>
  );
}
