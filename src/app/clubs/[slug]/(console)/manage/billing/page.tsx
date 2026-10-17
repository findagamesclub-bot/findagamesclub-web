import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PaymentsIcon from "@mui/icons-material/Payments";
import ReceiptIcon from "@mui/icons-material/ReceiptLong";
import StarIcon from "@mui/icons-material/StarBorder";
import TuneIcon from "@mui/icons-material/Tune";
import Panel from "@/components/members/Panel";
import PageHead from "@/components/ui/PageHead";
import Markdown from "@/components/ui/Markdown";
import PlanPicker from "@/components/billing/PlanPicker";
import FeaturedAsk from "@/components/billing/FeaturedAsk";
import FeaturedSlots from "@/components/billing/FeaturedSlots";
import ListingPayments from "@/components/billing/ListingPayments";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import {
  getBillingSettings, getPayments, getSubscriptionForClub,
} from "@/services/billing.service";
import { getClubSlots } from "@/services/featured.service";
import { getClubFeaturedAsks } from "@/services/featuredRequests.service";
import { ownerStanding, standingLabel, standingTone } from "@/utils/listing-billing";
import { formatPence } from "@/utils/format";
import { londonNow, shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Billing" };

/**
 * What this club pays, and how to pay it.
 *
 * Owner only. A manager runs the club; the money is the person whose name is on
 * it, which is the same line `billing.manage` draws in the capability matrix.
 */
export default async function ClubBillingPage({
  params,
}: PageProps<"/clubs/[slug]/manage/billing">) {
  const { slug } = await params;

  const viewer = await getCurrentProfile();
  if (!viewer) redirect(`/auth/sign-in?next=/clubs/${slug}/manage/billing`);

  const club = await getClubDetail(slug);
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (access.role !== "owner" && access.role !== "admin") notFound();

  const [subscription, settings, asks, slots] = await Promise.all([
    getSubscriptionForClub(club.id),
    getBillingSettings(),
    // Both deliberately in the same wave and outside the billing switch below:
    // a club can lead the homepage while listing charges are off, which is the
    // state the site is in today (0155 draws the same line).
    getClubFeaturedAsks(club.id),
    getClubSlots(club.id),
  ]);

  const payments = subscription ? await getPayments(subscription.id) : [];
  // No subscription means nobody has ever billed this listing, and that is
  // every club that was in the directory before charging was switched on. 0112
  // opens a subscription only for a listing sent in after that, and its header
  // promises the ones already up are untouched. Defaulting to "awaiting
  // payment" broke that promise on screen: Didcot was told it was not live and
  // shown bank details while it was leading the homepage. A club that owes
  // money has a row; one that does not, does not.
  const standing = subscription?.standing ?? "not_required";

  // Charging switched off means nobody owes anything, whatever their
  // subscription says. A club that had paid was still being told "Paid up to
  // 23 Oct, we will email you before it runs out" and shown bank details, with
  // the cron switched off and no email ever coming. The history below stays,
  // because they did pay and deleting that would be a lie of a different kind.
  const charging = settings.enabled;
  const tone = charging ? standingTone(standing) : "neutral";
  const hidden = club.status === "suspended";

  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <PageHead
        title="Billing"
        lede="What your listing costs, what you have paid, and how to pay it."
      />

      <Stack spacing={2.5}>
        <Panel title="Where you stand" icon={PaymentsIcon}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <Chip size="small"
                label={charging ? standingLabel(standing) : "Nothing to pay"}
                sx={{ fontWeight: 700, color: "#fff",
                      bgcolor: tone === "good" ? tokens.positive
                        : tone === "bad" ? tokens.danger
                          : tone === "warn" ? tokens.brass : tokens.inkMuted }} />
              {charging && subscription && subscription.price_pence > 0 ? (
                <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                                  color: tokens.inkMuted }}>
                  {`${formatPence(subscription.price_pence, subscription.currency)} `
                    + `${subscription.plan_interval === "yearly" ? "a year" : "a month"}`}
                </Typography>
              ) : null}
            </Stack>

            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {!charging
                ? payments.length > 0
                  ? "We are not charging for listings at the moment, so there is "
                    + "nothing to pay and nothing runs out. What you paid before is "
                    + "below."
                  : "Your listing is free. There is nothing to pay and nothing to "
                    + "set up."
                : ownerStanding(standing, {
                    paidTo: subscription?.current_period_end
                      ? shortDate(subscription.current_period_end.slice(0, 10)) : null,
                    graceEnds: subscription?.grace_ends_on
                      ? shortDate(subscription.grace_ends_on.slice(0, 10)) : null,
                    hidden,
                  })}
            </Typography>
          </Stack>
        </Panel>

        {/* Only with a subscription to move. Charging off means there is no
            plan yet, and a club picking between two prices nobody is charging
            would be choosing the shape of a bill that does not exist. */}
        {charging && subscription ? (
          <Panel title="Your plan" icon={TuneIcon}>
            <PlanPicker
              slug={slug}
              current={subscription.plan_interval === "yearly" ? "yearly" : "monthly"}
              monthlyPence={settings.monthly_price_pence}
              yearlyPence={settings.yearly_price_pence}
              currency={subscription.currency}
              renewsOn={subscription.current_period_end
                ? shortDate(subscription.current_period_end.slice(0, 10)) : null}
            />
          </Panel>
        ) : null}

        <Panel title="Lead the homepage" icon={StarIcon}>
          <Stack spacing={2.5}>
            {/* The slots first, because "where am I up to" comes before "ask
                for another". A London day, like every other date here. */}
            <FeaturedSlots slots={slots} today={londonNow().date} />
            <FeaturedAsk
              slug={slug}
              open={asks.open}
              answered={asks.answered}
              pricePence={settings.featured_price_pence}
              days={settings.featured_duration_days}
              currency={settings.currency ?? "GBP"}
            />
          </Stack>
        </Panel>

        {/* Only when there is something to pay. A free listing being shown bank
            details is the page answering a question nobody asked. */}
        {charging && standing !== "not_required" && settings.payment_instructions_md ? (
          <Panel title="How to pay">
            <Markdown source={settings.payment_instructions_md} />
          </Panel>
        ) : null}

        <Panel title="What you have paid" icon={ReceiptIcon}>
          <ListingPayments payments={payments} />
        </Panel>
      </Stack>
    </Container>
  );
}
