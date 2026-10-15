import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import MonoLabel from "@/components/ui/MonoLabel";
import BackLink from "@/components/ui/BackLink";
import AccountControls from "@/components/admin/AccountControls";
import AccountProfile from "@/components/admin/AccountProfile";
import AccountClubs from "@/components/admin/AccountClubs";
import AccountTally from "@/components/admin/AccountTally";
import AccountHistory from "@/components/admin/AccountHistory";
import { getAccount } from "@/services/adminAccounts.service";
import { getCurrentProfile } from "@/services/auth.service";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Account" };

export default async function AdminAccountPage({
  params,
}: PageProps<"/admin/accounts/[id]">) {
  const { id } = await params;
  const found = await getAccount(id);
  if (!found) notFound();

  const { account, history, profile, clubs, clubsFailed, tally } = found;
  const viewer = await getCurrentProfile();
  const isSelf = viewer?.id === account.id;

  return (
    <>
      <BackLink href="/admin/accounts" label="All accounts" />

      <PageHead
        title={account.name}
        lede={[
          account.email,
          account.role === "admin" ? "Site admin" : null,
          account.active ? null : "Suspended",
        ].filter(Boolean).join(" · ")}
      />

      {/* Two columns, the same split the submission review screen uses: the
          record on the left and what to do about it on the right. One column
          was why the client's screenshot is two thirds empty page, and it put
          the three buttons above a history nobody had read yet. */}
      <Box sx={{ display: "grid", gap: 3, alignItems: "start",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                        md: "minmax(0, 2fr) minmax(300px, 1fr)" } }}>
        <Stack spacing={3}>
          {/* Where this person stands, club by club. First, because in a club
              directory that is what somebody IS. */}
          <Box>
            <MonoLabel>Their clubs</MonoLabel>
            <AccountClubs clubs={clubs} failed={clubsFailed} />
          </Box>

          <Box>
            <MonoLabel>Their profile</MonoLabel>
            {profile ? (
              <AccountProfile profile={profile} />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                The profile would not load. Check the latest migrations have been
                run, then try again.
              </Typography>
            )}
          </Box>

          <Box>
            <MonoLabel>What we hold</MonoLabel>
            <AccountTally tally={tally} />
          </Box>
        </Stack>

        <Stack spacing={3}>
        <Box>
          <MonoLabel>The account</MonoLabel>
          <Stack spacing={0.75}
            sx={{ px: 2, py: 1.75, borderRadius: 1.5,
                  border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
            <Fact label="Signed up" value={shortDate(account.joined) ?? "unknown"} />
            <Fact label="Last signed in"
              value={account.lastSeen ? shortDate(account.lastSeen) ?? "unknown" : "Never"} />
            <Fact label="Status" value={account.active ? "Active" : "Suspended"} />
          </Stack>
        </Box>

        <Box>
          <MonoLabel>What you can do</MonoLabel>
          {isSelf ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              This is your own account. Suspending yourself or removing your own admin
              access would lock you out, so neither is offered here.
            </Typography>
          ) : (
            <AccountControls
              profileId={account.id}
              name={account.name}
              email={account.email}
              active={account.active}
              isAdmin={account.role === "admin"}
            />
          )}
        </Box>

        <Box>
          <MonoLabel>History</MonoLabel>
          <AccountHistory history={history} />
        </Box>
        </Stack>
      </Box>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                        letterSpacing: "0.08em", color: tokens.inkMuted, minWidth: 120 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography sx={{ fontFamily: display, fontSize: "0.92rem" }}>{value}</Typography>
    </Stack>
  );
}
