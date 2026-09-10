import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import MonoLabel from "@/components/ui/MonoLabel";
import BackLink from "@/components/ui/BackLink";
import AccountControls from "@/components/admin/AccountControls";
import { getAccount } from "@/services/adminAccounts.service";
import { getCurrentProfile } from "@/services/auth.service";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Account" };

const WORDS: Record<string, string> = {
  suspended: "Suspended",
  restored: "Restored",
  made_admin: "Made a site admin",
  removed_admin: "Admin access removed",
};

export default async function AdminAccountPage({
  params,
}: PageProps<"/admin/accounts/[id]">) {
  const { id } = await params;
  const found = await getAccount(id);
  if (!found) notFound();

  const { account, history } = found;
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
          {history.length ? (
            <Stack spacing={0.5}>
              {history.map((entry) => (
                <Stack key={entry.id} direction="row" spacing={1.5}
                  sx={{ alignItems: "baseline", px: 2, py: 1.25, borderRadius: 1.5,
                        border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                        flexWrap: "wrap", rowGap: 0.25 }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                    letterSpacing: "0.08em", color: tokens.inkMuted,
                                    minWidth: 68, flexShrink: 0 }}>
                    {(shortDate(entry.at) ?? "").toUpperCase()}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.92rem" }}>
                      {WORDS[entry.action] ?? entry.action}
                    </Typography>
                    {entry.reason ? (
                      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                        {entry.reason}
                      </Typography>
                    ) : null}
                  </Box>
                  <Typography variant="body2"
                    sx={{ color: tokens.inkMuted, fontSize: "0.82rem", flexShrink: 0 }}>
                    {entry.actor}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Nothing has been done to this account.
            </Typography>
          )}
        </Box>
      </Stack>
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
