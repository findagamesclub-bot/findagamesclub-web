/**
 * The five steps, in one place.
 *
 * Legacy's own labels and order (guided builder, main.js ~9073). Two screens
 * render them now: the console's editor for a club that exists, and the public
 * builder for one that does not. A second copy of this list is a second chance
 * for the two to disagree about what step three is called.
 */
export const LISTING_STEPS = [
  { slug: "profile", label: "Profile" },
  { slug: "content", label: "Content" },
  { slug: "pricing", label: "Pricing" },
  { slug: "schedule", label: "Schedule" },
  { slug: "review", label: "Review" },
] as const;

export type StepSlug = (typeof LISTING_STEPS)[number]["slug"];

export function isStep(value: string): value is StepSlug {
  return LISTING_STEPS.some((step) => step.slug === value);
}

/** Where a step sits, counting from 1. Zero for anything that is not a step. */
export function stepNumber(slug: string): number {
  return LISTING_STEPS.findIndex((step) => step.slug === slug) + 1;
}

export function stepLabel(slug: string): string {
  return LISTING_STEPS.find((step) => step.slug === slug)?.label ?? "";
}

/** The step after this one, or null at the end. */
export function nextStep(slug: string): StepSlug | null {
  const at = stepNumber(slug);
  return at > 0 && at < LISTING_STEPS.length ? LISTING_STEPS[at]!.slug : null;
}

/** The step before this one, or null at the start. */
export function previousStep(slug: string): StepSlug | null {
  const at = stepNumber(slug);
  return at > 1 ? LISTING_STEPS[at - 2]!.slug : null;
}

/**
 * What the resume card says.
 *
 * Names the step rather than only numbering it. "Step 3 of 5" tells somebody
 * how far they got; "Pricing" tells them what they are walking back into, and
 * on a phone a week later that is the half that matters.
 */
export function resumeLabel(lastStep: string): string {
  const at = stepNumber(lastStep);
  if (at < 1) return `Step 1 of ${LISTING_STEPS.length}, ${LISTING_STEPS[0]!.label}`;
  return `Step ${at} of ${LISTING_STEPS.length}, ${stepLabel(lastStep)}`;
}
