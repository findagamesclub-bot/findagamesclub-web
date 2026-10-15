/**
 * Whether written coaching can run at all on this site, and what to say.
 *
 * Three states rather than a boolean, because the one person who can change it
 * needs to know which of them it is. A member does not: from their side a site
 * with no provider key and a site with the switch off are the same site, so
 * they get one sentence either way and it does not mention an environment
 * variable.
 *
 * In `utils` rather than `lib/ai`, which is `server-only`: the panels are
 * client components and a `server-only` import from one of those takes the
 * page down. 0186 paid for that once already.
 */

export type AiDeployment =
  | "on"
  /** `AI_ENABLED=false`, or `AI_FEATURES` leaves this one out. A decision. */
  | "off"
  /** Enabled, and no provider key to call. A gap rather than a decision. */
  | "no_key";

/**
 * What a member reads where the Run button would have been.
 *
 * "This site", never "this deployment". A club secretary does not have a
 * deployment, and the word is the tell that a message was written for whoever
 * built the thing rather than for whoever is reading it.
 *
 * Neither sentence apologises and neither says "try again", because there is
 * nothing to try: both of these fail identically for ever until somebody with
 * the keys changes something.
 */
export const AI_DEPLOYMENT_COPY: Record<Exclude<AiDeployment, "on">, string> = {
  off: "Written coaching is switched off for this site.",
  no_key: "Written coaching is not available on this site yet. It is built and waiting on an account with the company that provides it.",
};

/** The admin's version, which does name the thing to change. */
export const AI_DEPLOYMENT_ADMIN: Record<AiDeployment, {
  headline: string; detail: string;
}> = {
  on: {
    headline: "Written coaching is on.",
    detail: "Members on a tier that includes it can run the list coach, match-up analysis, opponent scouting and the season coach.",
  },
  off: {
    headline: "Written coaching is switched off.",
    detail: "AI_ENABLED is set to false, or AI_FEATURES names a shorter list. Nothing reaches a provider and nothing is charged.",
  },
  no_key: {
    headline: "Written coaching has no account behind it yet.",
    detail: "Set ANTHROPIC_API_KEY (or OPENAI_API_KEY with AI_PROVIDER=openai) and every feature turns on together. Set AI_PROVIDER=stub to walk the whole path with no key and no cost, which answers with obvious placeholder text.",
  },
};
