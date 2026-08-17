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

  const result = await auth.signUp({ email: email(data), password: password(data), fullName });
  if (!result.ok) return { error: result.error };

  redirect(`/auth/check-email?to=${encodeURIComponent(email(data))}`);
}

export async function signInAction(_prev: FormState, data: FormData): Promise<FormState> {
  const result = await auth.signIn(email(data), password(data));
  if (!result.ok) return { error: result.error };
  redirect("/clubs");
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
  redirect("/clubs");
}
