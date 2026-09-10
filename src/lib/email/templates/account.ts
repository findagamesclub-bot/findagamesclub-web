import { build, greet, type Email } from "./build";

/**
 * What the site does to somebody's account, told to them.
 *
 * Being suspended without being told is the same experience as the site being
 * broken: the password stops working, the pages stop loading, and nobody has
 * said anything. The reason goes in the message because it is the only thing
 * that makes it a decision rather than a disappearance, and because the person
 * it happened to is already allowed to read it.
 */
export function accountSuspended(params: {
  name?: string;
  reason?: string;
  contactUrl: string;
}): Email {
  const reason = params.reason?.trim();

  return build("Your FindAGamesClub account has been suspended", {
    previewText: "Your account has been suspended and you cannot sign in.",
    eyebrow: "Account suspended",
    heading: "Your account has been suspended",
    body: [
      greet(params.name),
      "You will not be able to sign in while this is in place. Your clubs, bookings and posts are untouched and are still there if the suspension is lifted.",
      reason ? `The reason given was: ${reason}` : "",
      "If you think this is a mistake, the link below goes to the people who can look at it again. Replies to this address are not read.",
    ].filter(Boolean),
    action: { label: "How to reach the site team", url: params.contactUrl },
  });
}

export function accountRestored(params: { name?: string; signInUrl: string }): Email {
  return build("Your FindAGamesClub account is active again", {
    previewText: "You can sign in again.",
    eyebrow: "Account restored",
    heading: "Your account is active again",
    body: [
      greet(params.name),
      "The suspension on your account has been lifted and you can sign in as before. Everything you had is where you left it: your clubs, your bookings and your place on any team you were on.",
    ],
    action: { label: "Sign in", url: params.signInUrl },
  });
}
