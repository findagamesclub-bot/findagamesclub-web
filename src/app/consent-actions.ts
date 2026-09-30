"use server";

import { cookies } from "next/headers";
import { CONSENT_COOKIE, CONSENT_MONTHS, consentMaxAge, parseConsent } from "@/utils/consent";

export type ConsentState = { error?: string; notice?: string };

/**
 * Recording a cookie choice.
 *
 * A server action rather than a line of `document.cookie`, for two reasons.
 * The choice is then written by the server with the attributes it decides,
 * which is where a cookie's `secure` and `samesite` belong. And it gives the
 * banner the same shape as every other action on the site: a button that shows
 * it is working, and a toast that says what happened. A spinner over a
 * synchronous browser write would have been theatre.
 */
export async function chooseConsentAction(
  _prev: ConsentState, data: FormData,
): Promise<ConsentState> {
  const choice = parseConsent(String(data.get("choice") ?? ""));
  if (!choice) {
    return { error: "We could not record that choice. Reload the page and try again." };
  }

  try {
    (await cookies()).set({
      name: CONSENT_COOKIE,
      value: choice,
      path: "/",
      maxAge: consentMaxAge(),
      sameSite: "lax",
      // Nothing reads this in the browser, so it does not need to be readable
      // there. In development over http, `secure` would stop it being set.
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    return { error: "We could not save that choice. Your browser may be blocking cookies." };
  }

  return {
    notice: choice === "all"
      ? `All cookies accepted. We will not ask again for ${CONSENT_MONTHS} months.`
      : "Necessary cookies only. Nothing optional will run.",
  };
}
