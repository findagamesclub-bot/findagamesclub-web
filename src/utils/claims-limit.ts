/**
 * How long a claim may be.
 *
 * A pure constant so the form, the service and the tests agree. The form caps
 * what can be typed, the service caps what can be sent, and the cap exists
 * because a claim somebody has to read and act on is a paragraph rather than an
 * essay, the same reasoning the review note follows.
 */
export const CLAIM_LIMIT = 1200;
