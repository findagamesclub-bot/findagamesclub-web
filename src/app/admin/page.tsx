import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import PageHead from "@/components/ui/PageHead";
import StatStrip from "@/components/ui/StatStrip";
import MonoLabel from "@/components/ui/MonoLabel";
import { countSite } from "@/repositories/adminAccounts.repository";
import { listAccounts } from "@/services/adminAccounts.service";
import { display, tokens } from "@/lib/tokens";

export const metadata = { title: "Site admin" };

export default async function AdminOverviewPage() {
  const [site, suspended] = await Promise.all([
    countSite().catch(() => ({ clubs: 0, liveClubs: 0, members: 0 })),
    listAccounts("", "suspended", 1, 1).then((r) => r.total).catch(() => 0),
  ]);

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
          { label: "Suspended", value: suspended, emphasis: suspended > 0 },
        ]}
      />

      <Box sx={{ mt: 3 }}>
        <MonoLabel>Where to go</MonoLabel>
        <NextLink href="/admin/accounts" style={{ textDecoration: "none", color: "inherit" }}>
          <Stack sx={{ px: 2, py: 1.75, borderRadius: 1.5,
                       border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                       "&:hover": { borderColor: tokens.brass } }}>
            <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700 }}>
              Accounts
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Find somebody, suspend or restore them, or hand out admin access.
            </Typography>
          </Stack>
        </NextLink>
      </Box>

      {/* Said plainly rather than shown as greyed-out tiles. A queue that reads
          zero because it does not exist yet is indistinguishable from one that
          is genuinely clear, and the second is the thing an admin acts on. */}
      <Box sx={{ mt: 3 }}>
        <MonoLabel>Not built yet</MonoLabel>
        <Typography variant="body2" sx={{ color: tokens.inkMuted, maxWidth: 620 }}>
          Listing submissions, claims, reported content, billing and featured listings
          each arrive with the stage that builds them. Nothing is hidden here in the
          meantime.
        </Typography>
      </Box>
    </>
  );
}
