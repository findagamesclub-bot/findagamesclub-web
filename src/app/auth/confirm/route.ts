import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands the confirmation and reset links. Exchanging the token here rather than
 * on Supabase's domain keeps the whole flow on findagamesclub.co.uk.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = params.get("next") ?? "/clubs";

  if (!tokenHash || !type) redirect("/auth/sign-in?error=invalid-link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) redirect("/auth/sign-in?error=expired-link");
  redirect(next);
}
