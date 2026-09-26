import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { display, mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import { initialsOf } from "@/utils/format";
import { STANDINGS, standingOf } from "@/utils/account-role";
import type { Account } from "@/services/adminAccounts.service";

/**
 * One account, as a card in the grid.
 *
 * Cards rather than a table that scrolls sideways: an admin answering a report
 * at eleven at night is on a phone, and a horizontal scrollbar under a table is
 * where a status column goes to hide. In a grid, like the clubs and events
 * lists, because a full-width row per person was one name and an email across
 * the whole page.
 *
 * Coloured by what the account is rather than by a hash — suspended, admin,
 * owner, manager, helper, member. Clubs hash their colour because a club's
 * colour means nothing except "this club"; here the colour is the answer to
 * "what is this person to the site", which is the question the page is for.
 * `standingOf` picks the highest, since somebody can own one club and help at
 * another, and a card has one border.
 *
 * Every colour has its word beside it. A border colour on its own is not
 * something a reader can look up, and the two that matter most, suspended and
 * admin, must not depend on somebody remembering which red was which.
 */
export default function AccountRow({ account }: { account: Account }) {
  // What they run supersedes how many they own: an owner holds a seat on their
  // own club's team, so printing both says "1 club · Owner of Didcot Wargames".
  const attached = [
    account.teamRoles
      || (account.clubsOwned
        ? `${account.clubsOwned} club${account.clubsOwned === 1 ? "" : "s"}`
        : null),
    account.memberships ? `${account.memberships} membership${account.memberships === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ");

  const standing = standingOf(account);
  const { label, border, fill } = STANDINGS[standing];

  return (
    <NextLink href={`/admin/accounts/${account.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Stack spacing={1.5}
        sx={{ height: "100%", p: 2, borderRadius: 1.5,
              border: `1px solid ${border}`,
              backgroundColor: tokens.paper,
              transition: "border-color 120ms ease",
              "&:hover": { borderColor: tokens.brass } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box aria-hidden sx={{
            flexShrink: 0, width: 40, height: 40, borderRadius: "50%",
            display: "grid", placeItems: "center",
            fontFamily: mono, fontSize: "0.76rem", fontWeight: 700,
            color: fill ? "#FFFFFF" : tokens.inkMuted,
            backgroundColor: fill ?? "transparent",
            border: `1px solid ${border}` }}>
            {initialsOf(account.name)}
          </Box>

          <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontFamily: display, fontSize: "1rem", fontWeight: 700,
                              minWidth: 0, overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {account.name}
            </Typography>
            {/* Wraps rather than truncates. An email you cannot read in full is
                no use for finding somebody, which is what this page is for. */}
            <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                              color: tokens.inkMuted, overflowWrap: "anywhere" }}>
              {account.email}
            </Typography>
          </Stack>
          <ChevronRightIcon sx={{ fontSize: 20, color: tokens.inkMuted, flexShrink: 0 }} />
        </Stack>

        {label ? (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }} useFlexGap>
            <Chip text={label} tone={border} />
            {/* Suspended replaces the role on the border, so an admin who has
                been suspended still says both rather than losing the one the
                reader needs to know before restoring them. */}
            {standing === "suspended" && account.role === "admin"
              ? <Chip text="ADMIN" tone={tokens.brass} /> : null}
          </Stack>
        ) : null}

        {/* Pushed down so every card in a row lines its footer up. */}
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted,
                          pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
          {[attached, `Joined ${shortDate(account.joined) ?? "unknown"}`]
            .filter(Boolean).join(" · ")}
        </Typography>
      </Stack>
    </NextLink>
  );
}

/** Text as well as colour, so the status is never carried by colour alone. */
function Chip({ text, tone }: { text: string; tone: string }) {
  return (
    <Typography sx={{ fontFamily: mono, fontSize: "0.58rem", fontWeight: 700,
                      letterSpacing: "0.1em", color: tone,
                      border: `1px solid ${tone}`, borderRadius: 0.75,
                      px: 0.625, py: 0.125, flexShrink: 0 }}>
      {text}
    </Typography>
  );
}
