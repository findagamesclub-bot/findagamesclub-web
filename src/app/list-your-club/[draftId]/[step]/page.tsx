import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import { carryListingFrom, listingBackTarget } from "@/utils/back-link";
import ListingSteps from "@/components/listing/ListingSteps";
import ProfileStep from "@/components/listing/ProfileStep";
import ContentStep from "@/components/listing/ContentStep";
import ScheduleStep from "@/components/listing/ScheduleStep";
import PricingStep from "@/components/listing/PricingStep";
import SubmitStep from "@/components/listing/SubmitStep";
import { getBillingSettings } from "@/services/billing.service";
import { listingCostLine, listingSubmitNote } from "@/utils/listing-billing";
import type { StepTarget } from "@/components/listing/StepTarget";
import { getCurrentProfile } from "@/services/auth.service";
import { draftReadiness, getDraft } from "@/services/submissions.service";
import { getReviewHistory } from "@/services/submissionReview.service";
import { LISTING_STEPS, isStep } from "@/utils/listing-steps";
import { adminCanEdit, ownerCanEdit } from "@/utils/submission-status";
import { readinessSummary, readinessFraction } from "@/utils/listing-readiness";
import { parseTokens } from "@/utils/listing-draft";
import { draftValues } from "@/utils/draft-values";
import { formatPence } from "@/utils/format";
import { clubLogoUrl } from "@/utils/club-media";
import { publicUrl } from "@/lib/supabase/storage";

export const metadata = { title: "List your club" };

/**
 * The same five steps as the console's editor, for a club that does not exist.
 *
 * Everything on this page is the Stage 2 builder: the same step components, the
 * same stepper, the same readiness checks. What differs is where a save lands,
 * and that is one hidden field. A second set of forms would be a second set of
 * validation rules to keep in step, and the one thing certain to happen is that
 * they would drift.
 *
 * A step per address rather than a wizard held in memory, which is the whole
 * point: a club secretary who stops after two steps on a club night comes back
 * to the one they were on, and legacy loses the lot.
 */
export default async function ListingDraftStepPage({
  params, searchParams,
}: PageProps<"/list-your-club/[draftId]/[step]">) {
  const { draftId, step } = await params;
  // Which door they came in by. Two pages show these cards, and back used to go
  // to whichever one was hardcoded rather than the one they were standing on.
  const { from } = await searchParams;
  const back = listingBackTarget(from);
  const trail = carryListingFrom(from);
  if (!isStep(step)) notFound();

  const viewer = await getCurrentProfile();
  if (!viewer) {
    redirect(`/auth/sign-in?next=/list-your-club/${draftId}/${step}`);
  }

  // RLS hands back nothing for somebody else's listing, so a missing row is
  // "not yours" and "not here" at once, and both are a 404.
  const draft = await getDraft(Number(draftId));
  if (!draft) notFound();

  // Sent, approved or stopped. The card on /account is where it is explained;
  // a builder that let somebody keep typing into a listing under review would
  // be saving into a row the policy refuses.
  //
  // An admin is the exception the client asked for: they may open the same
  // five steps on anything that has been sent and is not published yet, so
  // they can put a listing right rather than sending it back over a typo.
  // `club_submissions_edit` (0202) is what actually allows the save; this
  // only decides whether the screen offers one, and the two name the same
  // states on purpose.
  const asAdmin = viewer.role === "admin" && draft.owner_id !== viewer.id;
  const mayEdit = asAdmin ? adminCanEdit(draft.status) : ownerCanEdit(draft.status);
  if (!mayEdit) redirect(asAdmin ? `/admin/submissions/${draft.id}` : "/account");

  // Only the last step draws these, so the four before it do not pay for reads
  // they never render. One wave, because neither depends on the other.
  const [history, billing] = step === "review"
    ? await Promise.all([getReviewHistory(draft.id), getBillingSettings()])
    : [[], null];

  const payload = draft.payload ?? {};
  const { checks, status, done } = draftReadiness(payload);
  const values = draftValues(payload);
  const target: StepTarget = { kind: "draft", id: draft.id, asAdmin };
  const base = `/list-your-club/${draft.id}`;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      {/* The way out. The step tabs move between steps and nothing moved out of
          the flow at all, so somebody four steps in had the browser's own back
          button and nothing else. Everything is saved, so leaving costs
          nothing, and the label says where it goes rather than "Back". */}
      {/* An admin came from the review screen and goes back to it, because
          that is where the decision is. The club's own two doors are
          unchanged. */}
      <BackLink
        href={asAdmin ? `/admin/submissions/${draft.id}` : back.href}
        label={asAdmin ? "Back to the review" : back.label} />

      <PageHead
        title={asAdmin ? `Editing ${draft.club_name || "this listing"}` : "List your club"}
        lede={asAdmin
          ? "The club's own five steps, so a listing can be put right rather than sent back over a typo. Everything saves as you go, and the club sees what you change."
          : "Five steps. Everything saves as you go, so you can stop and come back whenever you like."}
      />

      <ListingSteps
        trail={trail}
        steps={LISTING_STEPS.map((s) => ({
          ...s,
          status: status[LISTING_STEPS.findIndex((x) => x.slug === s.slug) + 1] ?? "",
          done: done[LISTING_STEPS.findIndex((x) => x.slug === s.slug) + 1] ?? false,
        }))}
        current={step}
        base={base}
        summary={readinessSummary(checks)}
        fraction={readinessFraction(checks)}
      />

      {step === "profile" ? (
        <ProfileStep
          target={target}
          values={{ ...values.profile, ages: parseTokens(values.profile.ages) }}
        />
      ) : null}

      {step === "content" ? (
        <ContentStep
          target={target}
          clubId={null}
          values={{
            ...values.content,
            logo: {
              url: clubLogoUrl({ logoPath: values.content.logoPath }, publicUrl),
              path: values.content.logoPath,
            },
            // No slug until it is approved, so the monogram is keyed on the
            // name. Same name, same colour, which is what a preview needs.
            mark: { slug: draft.club_name, name: draft.club_name },
          }}
        />
      ) : null}

      {step === "pricing" ? (
        <PricingStep
          target={target}
          models={values.pricing.models}
          tiers={values.pricing.tiers}
          loyaltyEnabled={values.pricing.loyaltyEnabled}
        />
      ) : null}

      {step === "schedule" ? (
        <ScheduleStep
          target={target}
          nights={values.schedule.nights}
          notices={values.schedule.notices}
        />
      ) : null}

      {step === "review" ? (
        <SubmitStep
          draftId={draft.id}
          checks={checks}
          base={base}
          note={draft.status === "changes_requested" ? draft.review_note : undefined}
          history={history}
          cost={billing?.enabled ? listingCostLine(billing) : null}
          submitNote={listingSubmitNote(
            billing ?? { enabled: false, monthly_price_pence: 0, yearly_price_pence: 0 })}
          // Only when both are actually sold. A club offered one price is not
          // being asked a question, and a radio with a single option is a
          // control pretending there is a decision.
          plan={billing?.enabled
            && billing.monthly_price_pence > 0 && billing.yearly_price_pence > 0
            ? {
                current: draft.plan_interval === "yearly" ? "yearly" : "monthly",
                monthly: `${formatPence(billing.monthly_price_pence)} a month`,
                yearly: `${formatPence(billing.yearly_price_pence)} a year`,
              }
            : null}
        />
      ) : null}
    </Container>
  );
}
