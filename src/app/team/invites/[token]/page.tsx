import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/components/ui/EmptyState";
import InviteReply from "@/components/console/InviteReply";
import { getCurrentProfile } from "@/services/auth.service";
import { getInviteWelcome } from "@/services/clubTeam.service";
import InviteWelcome from "@/components/console/InviteWelcome";
import { findInviteByToken } from "@/repositories/clubTeam.repository";
import { ROLE_LABEL, ROLE_SUMMARY, toClubRole } from "@/utils/club-access";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "An invitation" };

/**
 * The page an invitation link opens.
 *
 * The token is not the authorisation. The select policy only returns the row
 * to the person it was addressed to, and the function checks again on the way
 * in, so somebody who is sent a link by mistake sees the same thing as
 * somebody who guessed one.
 */
export default async function InvitePage({ params }: PageProps<"/team/invites/[token]">) {
  const { token } = await params;

  const viewer = await getCurrentProfile();

  // Most people opening one of these have never used the site. Bouncing them
  // to a sign-in form told them nothing about the club, the role, or the fact
  // that they need an account first.
  if (!viewer) {
    const welcome = await getInviteWelcome(token);
    return (
      <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
        {welcome && welcome.status === "open" ? (
          <InviteWelcome welcome={welcome} token={token} />
        ) : (
          <EmptyState
            title={welcome?.status === "expired"
              ? "This invitation has expired"
              : "This invitation is no longer open"}
            description={welcome?.status === "expired"
              ? `Invitations last a fortnight. Ask ${welcome.clubName} to send another.`
              : "It has already been answered, or the club withdrew it. Ask them to send a new one."}
            action={{ label: "Browse the directory", href: "/clubs" }}
          />
        )}
      </Container>
    );
  }

  const invite = await findInviteByToken(token).catch(() => null);
  const role = toClubRole(invite?.role);

  const gone = !invite || !role
    || invite.accepted_at || invite.declined_at || invite.revoked_at;
  const expired = Boolean(invite && new Date(invite.expires_at).getTime() < Date.now());

  return (
    <Container maxWidth="sm" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      {gone ? (
        <EmptyState
          title="This invitation is no longer open"
          description="It has already been answered, or the club withdrew it. Ask them to send a new one."
          action={{ label: "Browse the directory", href: "/clubs" }}
        />
      ) : expired ? (
        <EmptyState
          title="This invitation has expired"
          description={`Invitations last a fortnight. Ask ${invite.clubs?.name ?? "the club"} to send another.`}
          action={{ label: "Open the club", href: `/clubs/${invite.clubs?.slug ?? ""}` }}
        />
      ) : (
        <Stack spacing={1}>
          <Typography variant="overline" sx={{ color: tokens.inkMuted }}>
            An invitation
          </Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: "1.8rem", md: "2.2rem" } }}>
            Help run {invite.clubs?.name ?? "a club"}
          </Typography>
          <Typography variant="body1" sx={{ color: tokens.inkMuted, mt: 1 }}>
            They have asked you to join their team as a {ROLE_LABEL[role].toLowerCase()}.
          </Typography>

          <Box sx={{ mt: 2, px: 2.5, py: 2, borderRadius: 1.5,
                     border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, mb: 0.5 }}>
              What you would be able to do
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {ROLE_SUMMARY[role]}
            </Typography>
          </Box>

          <InviteReply token={token} clubSlug={invite.clubs?.slug ?? ""} />
        </Stack>
      )}
    </Container>
  );
}
