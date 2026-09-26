import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import PageHead from "@/components/ui/PageHead";
import StatStrip from "@/components/ui/StatStrip";
import MonoLabel from "@/components/ui/MonoLabel";
import { countSite } from "@/repositories/adminAccounts.repository";
import { listAccounts } from "@/services/adminAccounts.service";
import { countWaitingSubmissions } from "@/services/submissionReview.service";
import { countOverdue } from "@/services/billing.service";
import { countOpenClaims } from "@/services/claims.service";
import { countWaiting } from "@/services/moderation.service";
import { display, mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Site admin" };

export default async function AdminOverviewPage() {
  // One wave. Each is a count rather than a list, so the whole row costs one
  // round trip.
  const [site, suspended, requests, claims, owed, reported] = await Promise.all([
    countSite().catch(() => ({ clubs: 0, liveClubs: 0, members: 0, eventsThisMonth: 0 })),
    listAccounts("", "suspended", 1, 1).then((r) => r.total).catch(() => 0),
    countWaitingSubmissions().catch(() => 0),
    countOpenClaims().catch(() => 0),
    countOverdue().catch(() => 0),
    countWaiting().catch(() => 0),
  ]);

  // The rail carries these as badges, but a badge is a dot you notice on the
  // way past. The page an admin opens first should say what is waiting, and
  // link to it. A queue with nothing in it says so rather than vanishing,
  // because "clear" and "not there" are different answers.
  const queues = [
    { label: "Club requests", count: requests, href: "/admin/submissions",
      blurb: "People asking to have their club put in the directory.",
      clear: "Nothing waiting. The queue is clear." },
    { label: "Club claims", count: claims, href: "/admin/claims",
      blurb: "People saying a listing in the directory is their club.",
      clear: "Nobody is waiting on an answer." },
    { label: "Money owed", count: owed, href: "/admin/billing",
      blurb: "Listings overdue, lapsed, or waiting to be paid for.",
      clear: "Every listing is paid up." },
    { label: "Reported", count: reported, href: "/admin/moderation",
      blurb: "Reviews, posts and messages somebody says break the rules.",
      clear: "Nothing has been reported." },
  ];

  // Not queues: nobody is waiting on an answer from any of them. They are here
  // because "find that club" and "find that event" are the two things an admin
  // opens this console to do that are not somebody else's request.
  const places = [
    { label: "Clubs", href: "/admin/clubs",
      blurb: "Every club on the site, live or not. Search by name or town." },
    { label: "Events", href: "/admin/events",
      blurb: "Every event any club has put up, upcoming or past." },
    { label: "Accounts", href: "/admin/accounts",
      blurb: "Find somebody, suspend or restore them, or hand out admin access." },
  ];

  return (
    <>
      <PageHead
        title="Site admin"
        lede="What is on the site, and who is on it."
      />

      <StatStrip
        stats={[
          { label: "Live clubs", value: site.liveClubs },
          { label: "Clubs", value: site.clubs },
          { label: "Accounts", value: site.members },
          { label: "Events this month", value: site.eventsThisMonth },
          { label: "Suspended", value: suspended, emphasis: suspended > 0 },
        ]}
      />

      <Box sx={{ mt: 3 }}>
        <MonoLabel>Waiting on you</MonoLabel>
        {/* Three across, like every other list in the console. Stacked, three
            queues that are usually all clear took the height of the screen to
            say so. */}
        <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          sm: "repeat(3, minmax(0, 1fr))" } }}>
          {queues.map((queue) => (
            <NextLink key={queue.href} href={queue.href}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <Stack spacing={1}
                sx={{ height: "100%", p: 2, borderRadius: 1.5,
                      border: `1px solid ${queue.count > 0 ? tokens.brass : tokens.rule}`,
                      backgroundColor: tokens.paper,
                      transition: "border-color 120ms ease",
                      "&:hover": { borderColor: tokens.brass } }}>
                <Stack direction="row" spacing={1.5}
                  sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Typography sx={{ fontFamily: display, fontSize: "0.95rem",
                                    fontWeight: 700, minWidth: 0 }}>
                    {queue.label}
                  </Typography>
                  {/* Never a bare 0. A clear queue says so underneath. */}
                  {queue.count > 0 ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "1.4rem", fontWeight: 700,
                                      color: tokens.brass, lineHeight: 1, flexShrink: 0 }}>
                      {queue.count}
                    </Typography>
                  ) : null}
                </Stack>
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {queue.count > 0 ? queue.blurb : queue.clear}
                </Typography>
              </Stack>
            </NextLink>
          ))}
        </Box>
      </Box>

      <Box sx={{ mt: 3 }}>
        <MonoLabel>Where to go</MonoLabel>
        <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          sm: "repeat(3, minmax(0, 1fr))" } }}>
          {places.map((place) => (
            <NextLink key={place.href} href={place.href}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <Stack spacing={1}
                sx={{ height: "100%", p: 2, borderRadius: 1.5,
                      border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                      transition: "border-color 120ms ease",
                      "&:hover": { borderColor: tokens.brass } }}>
                <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700 }}>
                  {place.label}
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {place.blurb}
                </Typography>
              </Stack>
            </NextLink>
          ))}
        </Box>
      </Box>

      {/* Said plainly rather than shown as greyed-out tiles. A queue that reads
          zero because it does not exist yet is indistinguishable from one that
          is genuinely clear, and the second is the thing an admin acts on.
          This listed claims, billing and featured long after they were built,
          so it was telling an admin a feature did not exist while they were
          using it. Trim it as each one lands. */}

    </>
  );
}
