import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { display, mono, tokens } from "@/lib/tokens";
import { shortDate } from "@/utils/dates";
import type { Account } from "@/services/adminAccounts.service";

/**
 * One account in the list.
 *
 * Cards on a phone rather than a table that scrolls sideways: an admin
 * answering a report at eleven at night is on a phone, and a horizontal
 * scrollbar under a table is where a status column goes to hide.
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

  return (
    <NextLink href={`/admin/accounts/${account.id}`}
      style={{ textDecoration: "none", color: "inherit" }}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "center", px: 2, py: 1.5, borderRadius: 1.5,
              border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
              "&:hover": { borderColor: tokens.brass } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
            <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700,
                              overflowWrap: "anywhere" }}>
              {account.name}
            </Typography>
            {account.role === "admin" ? <Chip text="ADMIN" tone={tokens.brass} /> : null}
            {!account.active ? <Chip text="SUSPENDED" tone={tokens.danger} /> : null}
          </Stack>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, fontSize: "0.82rem",
                                            overflowWrap: "anywhere" }}>
            {account.email}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted, fontSize: "0.78rem" }}>
            {[attached, `Joined ${shortDate(account.joined) ?? "unknown"}`]
              .filter(Boolean).join(" · ")}
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ fontSize: 20, color: tokens.inkMuted, flexShrink: 0 }} />
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
