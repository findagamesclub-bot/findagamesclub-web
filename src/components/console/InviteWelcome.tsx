import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinkButton from "@/components/ui/LinkButton";
import { ROLE_LABEL, ROLE_SUMMARY } from "@/utils/club-access";
import { mono, tokens } from "@/lib/tokens";
import type { InviteWelcome as Welcome } from "@/services/clubTeam.service";

/**
 * An invitation, shown to somebody who is not signed in.
 *
 * They used to be posted straight to a sign-in form, which said nothing about
 * the club, the role or the fact that most people arriving on this link have
 * never used the site at all. The point of an invitation is to reach the
 * treasurer who is not a member, so the page has to explain itself before it
 * asks for anything.
 *
 * The order of the two buttons follows what we know: an address that already
 * has an account is offered signing in first, and a stranger is offered making
 * one.
 */
export default function InviteWelcome({
  welcome, token,
}: {
  welcome: Welcome;
  token: string;
}) {
  const next = `/team/invites/${token}`;
  const role = ROLE_LABEL[welcome.role].toLowerCase();

  const signIn = (
    <LinkButton href={`/auth/sign-in?next=${encodeURIComponent(next)}`}
      variant={welcome.hasAccount ? "contained" : "outlined"} size="large">
      Sign in
    </LinkButton>
  );
  const signUp = (
    <LinkButton href={`/auth/sign-up?next=${encodeURIComponent(next)}`}
      variant={welcome.hasAccount ? "outlined" : "contained"} size="large">
      Create an account
    </LinkButton>
  );

  return (
    <Stack spacing={1}>
      <Typography variant="overline" sx={{ color: tokens.inkMuted }}>An invitation</Typography>
      <Typography variant="h1" sx={{ fontSize: { xs: "1.8rem", md: "2.2rem" } }}>
        Help run {welcome.clubName}
      </Typography>
      <Typography variant="body1" sx={{ color: tokens.inkMuted, mt: 1 }}>
        {welcome.invitedBy} has asked you to join their team as a {role}.
      </Typography>

      <Box sx={{ mt: 2.5, p: 2, borderRadius: 1.5, backgroundColor: tokens.brassSoft,
                 border: `1px solid ${tokens.rule}` }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                          letterSpacing: "0.12em", color: tokens.inkMuted, mb: 0.75 }}>
          WHAT A {ROLE_LABEL[welcome.role].toUpperCase()} CAN DO
        </Typography>
        <Typography variant="body2">{ROLE_SUMMARY[welcome.role]}</Typography>
      </Box>

      {/* Said before the buttons rather than after, because the question in
          somebody's head at this point is "do I have to join this club". */}
      <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 2.5 }}>
        {welcome.hasAccount
          ? "Sign in with the address this was sent to and the invitation will be waiting."
          : `You need an account before you can accept. It takes a minute, it is free, and you do not have to join ${welcome.clubName} as a member to help run it.`}
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
        {welcome.hasAccount ? <>{signIn}{signUp}</> : <>{signUp}{signIn}</>}
      </Stack>

      <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 2 }}>
        Use the same address the invitation was sent to. It is how the club
        knows the person accepting is the one they asked.
      </Typography>
    </Stack>
  );
}
