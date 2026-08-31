import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ClubLogo from "@/components/clubs/ClubLogo";
import PaymentRows from "./PaymentRows";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import type { MyClubMembership } from "@/services/myMemberships.service";

const STATUS: Record<MyClubMembership["status"], { label: string; tone: string; bg: string }> = {
  approved: { label: "Member", tone: "#1B5E20", bg: "#E7F3E8" },
  pending: { label: "Waiting on the club", tone: "#5c4310", bg: tokens.brassSoft },
  declined: { label: "Not accepted", tone: tokens.danger, bg: "#FBE9E7" },
  cancelled: { label: "You left", tone: tokens.inkMuted, bg: tokens.surface },
};

/** One labelled fact. Four of these answer the whole card. */
function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 600,
                        color: tone ?? tokens.ink }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * One club, and where the member stands with it.
 *
 * Every card is the same four facts in the same four places — status, tier,
 * joined, paid to — so a member with four clubs compares them by looking down
 * a column rather than reading four paragraphs. The payments sit inside the
 * card, folded away: they are the evidence for "paid up to", not a second
 * subject, and as a separate box beside the card they made every row a
 * different height.
 */
export default function MembershipCard({
  membership, action,
}: {
  membership: MyClubMembership;
  action?: React.ReactNode;
}) {
  const { faction } = clubIdentity(membership.club.slug, membership.club.name);
  const state = STATUS[membership.status];
  const paid = membership.standing;
  const isMember = membership.status === "approved";

  const money = !isMember ? null
    : paid.overdue
      ? { value: `Ran out ${shortDate(paid.paidThrough)}`, tone: tokens.danger }
      : paid.paidThrough
        ? { value: shortDate(paid.paidThrough) ?? "—", tone: "#1B5E20" }
        : paid.settledOneOff
          ? { value: "Paid once", tone: "#1B5E20" }
          : { value: "Nothing recorded", tone: tokens.inkMuted };

  return (
    <Stack sx={{ height: "100%", borderRadius: 2, border: `1px solid ${tokens.rule}`,
                 backgroundColor: tokens.paper, overflow: "hidden",
                 // A tier request or an overdue payment is marked on the card
                 // itself, so a grid can be scanned for trouble.
                 ...(membership.requestedTierKey || membership.standing.overdue
                   ? { borderColor: membership.standing.overdue ? tokens.danger : tokens.brass }
                   : {}) }}>
      <Stack direction="row" spacing={1.75}
        sx={{ px: 2.25, py: 2, alignItems: "center",
              borderBottom: `1px solid ${tokens.rule}` }}>
        <ClubLogo slug={membership.club.slug} name={membership.club.name}
          logoUrl={membership.club.logoUrl} size={42} ring={tokens.rule} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NextLink href={`/clubs/${membership.club.slug}`}
            style={{ color: "inherit", textDecoration: "none" }}>
            <Typography sx={{ fontFamily: display, fontSize: "1.05rem", fontWeight: 700,
                              "&:hover": { color: faction.base } }}>
              {membership.club.name}
            </Typography>
          </NextLink>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {membership.club.city.toUpperCase()}
          </Typography>
        </Box>

        <Chip size="small" label={state.label}
          sx={{ bgcolor: state.bg, color: state.tone, fontWeight: 700,
                fontSize: "0.7rem", flexShrink: 0 }} />
      </Stack>

      <Box sx={{ px: 2.25, py: 1.75, display: "grid", gap: 2,
                 gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))",
                                        sm: "repeat(3, minmax(0, 1fr))" } }}>
        <Fact label="TIER" value={membership.tierLabel ?? "—"} />
        <Fact
          label={isMember ? "JOINED" : "APPLIED"}
          value={shortDate(isMember ? membership.joinedAt : membership.requestedAt) ?? "—"}
        />
        {money ? <Fact label="PAID UP TO" value={money.value} tone={money.tone} /> : null}
      </Box>

      {membership.status === "pending" ? (
        <Typography variant="body2" sx={{ px: 2.25, pb: 2, color: tokens.inkMuted }}>
          The club decides who joins. You will get an email either way.
        </Typography>
      ) : null}

      {membership.status === "declined" && membership.declineReason ? (
        <Typography variant="body2" sx={{ px: 2.25, pb: 2, color: tokens.inkMuted }}>
          {membership.declineReason}
        </Typography>
      ) : null}

      {membership.payments.length ? (
        <Accordion disableGutters elevation={0} square
          sx={{ borderTop: `1px solid ${tokens.rule}`, "&::before": { display: "none" },
                backgroundColor: "transparent" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.25 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {`${membership.payments.length} PAYMENT${membership.payments.length === 1 ? "" : "S"}`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.25, pt: 0, pb: 1 }}>
            <PaymentRows payments={membership.payments} />
          </AccordionDetails>
        </Accordion>
      ) : null}

      {action ? (
        <Box sx={{ mt: "auto", px: 2.25, py: 1.75, borderTop: `1px solid ${tokens.rule}`,
                   backgroundColor: tokens.surface }}>
          {action}
        </Box>
      ) : null}
    </Stack>
  );
}
