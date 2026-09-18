import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import ListingSteps from "@/components/listing/ListingSteps";
import ProfileStep from "@/components/listing/ProfileStep";
import ContentStep from "@/components/listing/ContentStep";
import ScheduleStep from "@/components/listing/ScheduleStep";
import PricingStep from "@/components/listing/PricingStep";
import SubmitStep from "@/components/listing/SubmitStep";
import type { StepTarget } from "@/components/listing/StepTarget";
import { getCurrentProfile } from "@/services/auth.service";
import { draftReadiness, getDraft } from "@/services/submissions.service";
import { getReviewHistory } from "@/services/submissionReview.service";
import { LISTING_STEPS, isStep } from "@/utils/listing-steps";
import { ownerCanEdit } from "@/utils/submission-status";
import { readinessSummary, readinessFraction } from "@/utils/listing-readiness";
import { parseTokens } from "@/utils/listing-draft";
import { draftValues } from "@/utils/draft-values";

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
  params,
}: PageProps<"/list-your-club/[draftId]/[step]">) {
  const { draftId, step } = await params;
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
  if (!ownerCanEdit(draft.status)) redirect("/account");

  // Only the last step draws it, so the four before it do not pay for a read
  // they never render.
  const history = step === "review"
    ? await getReviewHistory(draft.id)
    : [];

  const payload = draft.payload ?? {};
  const { checks, status, done } = draftReadiness(payload);
  const values = draftValues(payload);
  const target: StepTarget = { kind: "draft", id: draft.id };
  const base = `/list-your-club/${draft.id}`;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      {/* The way out. The step tabs move between steps and nothing moved out of
          the flow at all, so somebody four steps in had the browser's own back
          button and nothing else. Everything is saved, so leaving costs
          nothing, and the label says where it goes rather than "Back". */}
      <BackLink href="/account/listings" label="Back to your listings" />

      <PageHead
        title="List your club"
        lede="Five steps. Everything saves as you go, so you can stop and come back whenever you like."
      />

      <ListingSteps
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
        <ContentStep target={target} clubId={null} values={values.content} />
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
        />
      ) : null}
    </Container>
  );
}
