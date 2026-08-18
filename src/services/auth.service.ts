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

export type AuthResult = { ok: true } | { ok: false; error: string };

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
    url: confirmUrl(data.properties.hashed_token, "signup", "/auth/confirmed"),
  });
  const sent = await sendEmail({ to: params.email, ...email });
  if (!sent.ok) return { ok: false, error: "Account created, but the email failed to send." };

  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });

  // Always report success: revealing which addresses exist is an information leak.
  if (error || !data) return { ok: true };

  const message = templates.resetPassword({
    name: (data.user?.user_metadata?.full_name as string) || undefined,
    url: confirmUrl(data.properties.hashed_token, "recovery", "/auth/reset-password"),
  });
  await sendEmail({ to: email, ...message });

  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("not confirmed")) {
      return { ok: false, error: "Confirm your email address before signing in. Check your inbox." };
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
