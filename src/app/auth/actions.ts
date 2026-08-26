"use server";

import { redirect } from "next/navigation";
import * as auth from "@/services/auth.service";

/** Server actions behind the auth forms. Each returns a message the form shows. */

export type FormState = { error?: string; notice?: string };

const email = (data: FormData) => String(data.get("email") ?? "").trim().toLowerCase();
const password = (data: FormData) => String(data.get("password") ?? "");

export async function signUpAction(_prev: FormState, data: FormData): Promise<FormState> {
  const fullName = String(data.get("fullName") ?? "").trim();
  if (!fullName) return { error: "Enter your name." };
  if (password(data) !== String(data.get("confirm") ?? "")) return { error: "Those passwords do not match." };

  const result = await auth.signUp({ email: email(data), password: password(data), fullName });
  if (!result.ok) return { error: result.error };

  redirect(`/auth/check-email?to=${encodeURIComponent(email(data))}`);
}

/**
 * Where to land after signing in.
 *
 * Only a path on this site. "//evil.example" is a valid URL to a browser, so
 * the leading-slash test alone would hand somebody an open redirect.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = String(raw ?? "");
  if (!next.startsWith("/") || next.startsWith("//")) return "/clubs";
  return next;
}

export async function signInAction(_prev: FormState, data: FormData): Promise<FormState> {
  const result = await auth.signIn(email(data), password(data));
  if (!result.ok) return { error: result.error };
  redirect(safeNext(data.get("next")));
}

export async function forgotPasswordAction(_prev: FormState, data: FormData): Promise<FormState> {
  await auth.requestPasswordReset(email(data));
  // Deliberately the same response whether or not the address exists.
  return { notice: "If that address has an account, a reset link is on its way." };
}

export async function resetPasswordAction(_prev: FormState, data: FormData): Promise<FormState> {
  if (password(data) !== String(data.get("confirm") ?? "")) return { error: "Those passwords do not match." };

  const result = await auth.updatePassword(password(data));
  if (!result.ok) return { error: result.error };
  // Same reason as the confirmation link: landing on the directory with no word
  // about what happened reads as though the form did nothing.
  redirect("/auth/confirmed?done=password");
}
