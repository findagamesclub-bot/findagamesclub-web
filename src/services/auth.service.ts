import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import * as templates from "@/lib/email/templates";

/**
 * Auth flows.
 *
 * Supabase would send its own plain emails on sign-up and reset. Instead we ask
 * it to *generate* the link without sending, then deliver our own branded
 * template through Resend. The link points at our domain, not Supabase's.
 */

export type AuthResult =
  | { ok: true }
  // `help` is a way out of the refusal, for the cases where reading the message
  // and trying again cannot possibly work.
  | { ok: false; error: string; help?: { label: string; href: string } };

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Our own confirm URL, so the address bar never shows a Supabase domain. */
function confirmUrl(tokenHash: string, type: string, next = "/clubs"): string {
  const params = new URLSearchParams({ token_hash: tokenHash, type, next });
  return `${siteUrl()}/auth/confirm?${params}`;
}

export async function signUp(params: {
  email: string;
  password: string;
  fullName: string;
  /**
   * Where to land after confirming, when they were on their way somewhere.
   * Somebody who arrived on an invitation should end up back on it rather than
   * on a page congratulating them for having an email address.
   */
  next?: string;
}): Promise<AuthResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: params.email,
    password: params.password,
    options: { data: { full_name: params.fullName } },
  });

  if (error) {
    // Don't confirm whether an address is already registered.
    if (error.message.toLowerCase().includes("already")) {
      return { ok: false, error: "That email cannot be used. Try signing in instead." };
    }
    return { ok: false, error: error.message };
  }

  const email = templates.verifyEmail({
    name: params.fullName,
    url: confirmUrl(data.properties.hashed_token, "signup", params.next || "/auth/confirmed"),
  });
  const sent = await sendEmail({ to: params.email, ...email });
  if (!sent.ok) return { ok: false, error: "Account created, but the email failed to send." };

  return { ok: true };
}

/**
 * Build the recovery link and send it in our own template.
 *
 * Supabase will send a reset email itself if asked to, and that is what the
 * admin console did: an unbranded message from an address nobody recognises,
 * in the middle of a product where every other email is ours. Generating the
 * link and sending it through Resend is the same work and one template.
 *
 * Reports honestly. The public entry point below is the one that has to lie
 * about whether an address exists.
 */
export async function sendRecoveryEmail(email: string): Promise<AuthResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No account with that address." };
  }

  const message = templates.resetPassword({
    name: (data.user?.user_metadata?.full_name as string) || undefined,
    url: confirmUrl(data.properties.hashed_token, "recovery", "/auth/reset-password"),
  });
  const sent = await sendEmail({ to: email, ...message });
  if (!sent.ok) return { ok: false, error: "Could not send that email. Try again." };

  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  // Anybody can reach this one, so it always reports success: telling a
  // stranger which addresses are registered is an information leak.
  await sendRecoveryEmail(email);
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // The code first, the wording second. Supabase sends a stable code
    // (`user_banned`, `email_not_confirmed`) alongside a message it is free to
    // reword, and matching only the message means a copy change upstream
    // quietly turns these back into "wrong password".
    const code = error.code ?? "";
    const said = error.message.toLowerCase();

    if (code === "email_not_confirmed" || said.includes("not confirmed")) {
      return { ok: false, error: "Confirm your email address before signing in. Check your inbox." };
    }

    // A suspended account is told so. It breaks the rule below on purpose:
    // "that email and password do not match" is a lie to somebody whose
    // password is correct, and it leaves them retyping it and asking for a
    // reset that will not help, with no idea anything was decided about them.
    // What it gives away is that an address exists and is suspended, which is
    // worth less than leaving somebody locked out with no way to ask.
    if (code === "user_banned" || said.includes("banned") || said.includes("suspend")) {
      return {
        ok: false,
        error: "This account has been suspended, so you cannot sign in.",
        // Named for what the page is, not for what we wish it did: /contact
        // is still a placeholder and cannot take an appeal yet. DEFERRED.md
        // records that this route is only as good as that page.
        help: { label: "How to reach the site team", href: "/contact" },
      };
    }

    // Same message whether the address exists or the password is wrong.
    return { ok: false, error: "That email and password do not match." };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  // Tell the account holder their password moved. If this reaches someone who
  // didn't do it, that's the only warning they get. A failure to send must not
  // fail the reset itself — the password has already changed by this point.
  const user = data.user;
  if (user?.email) {
    const message = templates.passwordChanged({
      name: (user.user_metadata?.full_name as string) || undefined,
      url: `${siteUrl()}/auth/sign-in`,
    });
    const sent = await sendEmail({ to: user.email, ...message });
    if (!sent.ok) console.error("password-changed notice failed to send", { userId: user.id });
  }

  return { ok: true };
}

/** The signed-in user's profile, or null. Safe to call anywhere on the server. */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, legacy_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  return data ? { ...data, email: auth.user.email ?? "" } : null;
}
