import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PageHead from "@/components/ui/PageHead";
import EmptyState from "@/components/ui/EmptyState";
import { getCurrentProfile } from "@/services/auth.service";
import { getMyInvites } from "@/services/clubTeam.service";
import { ROLE_LABEL } from "@/utils/club-access";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Your invitations" };

/**
 * Every club invitation waiting on the person reading.
 *
 * The notification links straight to the invitation it is about, so this page
 * is the fallback: somebody who read the bell on another device, lost the
 * link, or was invited to two clubs at once. Before it existed that address
 * was a 404, which is a poor thing to hand somebody being asked for a favour.
 */
export default async function TeamInvitesPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/team/invites");

  const invites = await getMyInvites();

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <PageHead
        title="Your invitations"
        lede={invites.length
          ? "Clubs that have asked you to help run them."
          : "Nothing is waiting on you."}
      />

      {invites.length ? (
        <Stack spacing={1.5}>
          {invites.map((invite) => (
            <NextLink key={invite.token} href={`/team/invites/${invite.token}`}
              style={{ textDecoration: "none", color: "inherit" }}>
              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "center", p: 2, borderRadius: 1.5,
                      border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                      "&:hover": { borderColor: tokens.brass } }}>
                <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{invite.clubName}</Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                    letterSpacing: "0.08em", color: tokens.inkMuted }}>
                    {ROLE_LABEL[invite.role].toUpperCase()}
                    {" · "}
                    {/* shortDate returns null on anything it cannot read, so
                        the date is dropped rather than printed as "null". */}
                    {invite.expired ? "EXPIRED" : sentLabel(invite.sentAt)}
                  </Typography>
                </Stack>
                <ChevronRightIcon sx={{ fontSize: 19, color: tokens.inkMuted, flexShrink: 0 }} />
              </Stack>
            </NextLink>
          ))}
        </Stack>
      ) : (
        <EmptyState
          title="No invitations"
          description="When a club asks you to help run it, the invitation appears here and in your notifications."
          action={{ label: "Browse the directory", href: "/clubs" }}
        />
      )}
    </Container>
  );
}

function sentLabel(iso: string): string {
  const when = shortDate(iso);
  return when ? `SENT ${when.toUpperCase()}` : "SENT";
}
