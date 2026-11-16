import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReceiptIcon from "@mui/icons-material/ReceiptLong";
import PaymentsIcon from "@mui/icons-material/Payments";
import Panel from "@/components/members/Panel";
import PageHead from "@/components/ui/PageHead";
import RecordPaymentDialog from "@/components/admin/RecordPaymentDialog";
import PaymentLedger from "@/components/admin/PaymentLedger";
import {
  getBillingSettings, getPayments, getSubscription,
} from "@/services/billing.service";
import { getMoneyHistory } from "@/services/moneyEvents.service";
import {
  ownerStanding, standingLabel, standingTone, suggestedAmount,
} from "@/utils/listing-billing";
import { formatPence } from "@/utils/format";
import { londonNow, shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "A subscription" };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}
      sx={{ alignItems: { sm: "baseline" } }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.08em", color: tokens.inkMuted,
                        minWidth: { sm: 112 }, flexShrink: 0 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography variant="body2" sx={{ minWidth: 0 }}>{value}</Typography>
    </Stack>
  );
}

/**
 * One club's money: where it stands, and every payment ever recorded.
 *
 * The ledger is the point of this screen. It cannot be edited by anybody, so
 * what is on it is what happened, and an admin chasing a club needs to be able
 * to say "we have you down for a cheque on the fourth".
 */
export default async function SubscriptionPage({
  params,
}: PageProps<"/admin/billing/[id]">) {
  const { id } = await params;

  const subscription = await getSubscription(Number(id));
  if (!subscription) notFound();

  const [payments, settings] = await Promise.all([
    getPayments(subscription.id),
    getBillingSettings(),
  ]);

  // One read for the whole ledger rather than one per row, and it rides a
  // second wave because it needs the ids the first one produced.
  const history = await getMoneyHistory(
    "listing", payments.map((one) => one.id));

  const tone = standingTone(subscription.standing);
  const hidden = subscription.club?.status === "suspended";

  return (
    <>
      <NextLink href="/admin/billing" style={{ textDecoration: "none" }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1.5 }}>
          <ArrowBackIcon sx={{ fontSize: 17, color: tokens.inkMuted }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>Back to billing</Typography>
        </Stack>
      </NextLink>

      <PageHead
        title={subscription.club?.name ?? subscription.submission?.club_name
          ?? "A listing with no club on it"}
        lede={[
          subscription.club?.city,
          `${formatPence(subscription.price_pence)} ${subscription.plan_interval === "yearly" ? "a year" : "a month"}`,
        ].filter(Boolean).join(" · ")}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2.5, alignItems: "center", flexWrap: "wrap" }}
        useFlexGap>
        <Chip size="small" label={standingLabel(subscription.standing)}
          sx={{ fontWeight: 700, color: "#fff",
                bgcolor: tone === "good" ? tokens.positive
                  : tone === "bad" ? tokens.danger
                    : tone === "warn" ? tokens.brass : tokens.inkMuted }} />
        {hidden ? (
          <Chip size="small" variant="outlined" label="Out of the directory"
            sx={{ fontWeight: 700, color: tokens.inkMuted, borderColor: tokens.rule }} />
        ) : null}
        {subscription.club?.slug ? (
          <NextLink href={`/clubs/${subscription.club.slug}`}
            style={{ color: tokens.brand, fontSize: "0.85rem" }}>
            Open the club page
          </NextLink>
        ) : null}
      </Stack>

      <Box sx={{ display: "grid", gap: 3, alignItems: "start",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(280px, 1fr)" } }}>
        <Panel title="The payments" icon={ReceiptIcon}>
          <PaymentLedger
            subscription={subscription.id}
            clubName={subscription.club?.name ?? "this listing"}
            payments={payments.map((payment) => ({
              id: payment.id,
              amountPence: payment.amount_pence,
              currency: payment.currency,
              method: payment.method,
              paidAt: payment.paid_at,
              reference: payment.reference ?? "",
              note: payment.note ?? "",
              periodStart: payment.period_start,
              periodEnd: payment.period_end,
              refundStatus: payment.refund_status ?? "not_due",
              refundedAt: payment.refunded_at,
              refundMethod: payment.refund_method ?? "",
              refundNote: payment.refund_note ?? "",
              editedAt: payment.edited_at,
            }))}
            history={Object.fromEntries(history)} />
        </Panel>

        <Stack spacing={2.5}>
          <Panel title="Where it stands" icon={PaymentsIcon}>
            <Stack spacing={1.25}>
              <Row label="Standing" value={standingLabel(subscription.standing)} />
              <Row label="Plan"
                value={subscription.plan_interval === "yearly" ? "Yearly" : "Monthly"} />
              <Row label="Paid to"
                value={subscription.current_period_end
                  ? shortDate(subscription.current_period_end.slice(0, 10)) ?? "Not known"
                  : "Never paid"} />
              <Row label="Grace ends"
                value={subscription.grace_ends_on
                  ? shortDate(subscription.grace_ends_on.slice(0, 10)) ?? "Not known"
                  : "Not applicable"} />
              <Row label="Owner" value={subscription.owner?.full_name || "No name set"} />

              <Typography variant="body2" sx={{ color: tokens.inkMuted, pt: 0.5 }}>
                {ownerStanding(subscription.standing, {
                  paidTo: subscription.current_period_end
                    ? shortDate(subscription.current_period_end.slice(0, 10)) : null,
                  graceEnds: subscription.grace_ends_on
                    ? shortDate(subscription.grace_ends_on.slice(0, 10)) : null,
                  hidden,
                })}
              </Typography>
            </Stack>
          </Panel>

          <Panel title="Money in">
            <RecordPaymentDialog
              subscription={subscription.id}
              clubName={subscription.club?.name ?? "this listing"}
              suggestedPence={suggestedAmount(subscription, settings)}
              // London's day from the server, so the box does not open on the
              // browser's idea of today for somebody in another timezone.
              today={londonNow().date}
            />
          </Panel>
        </Stack>
      </Box>
    </>
  );
}
