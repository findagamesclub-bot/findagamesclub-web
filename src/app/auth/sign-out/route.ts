import { redirect } from "next/navigation";
import { signOut } from "@/services/auth.service";

export async function POST(request: Request) {
  // Where to go afterwards. A path on this site and nothing else: a form field
  // that can name any URL turns signing out into an open redirect.
  const form = await request.formData().catch(() => null);
  const asked = String(form?.get("next") ?? "");
  const next = /^\/(?!\/)[\w\-./?=&%]*$/.test(asked) ? asked : "/clubs";

  await signOut();
  redirect(next);
}
