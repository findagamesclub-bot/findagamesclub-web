import { notFound } from "next/navigation";
import * as templates from "@/lib/email/templates";

/** Local-only gallery for checking email templates. Hidden in production. */
export default async function EmailPreviewPage({ searchParams }: PageProps<"/dev/email-preview">) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const which = (Array.isArray(params.t) ? params.t[0] : params.t) ?? "verify";
  const url = "https://findagamesclub.co.uk/auth/confirm?token=example-token-value";

  const email =
    which === "reset" ? templates.resetPassword({ name: "Gulnabi", url })
    : which === "welcome" ? templates.welcome({ name: "Gulnabi", url })
    : which === "changed" ? templates.emailChanged({ name: "Gulnabi", url, newEmail: "new@example.com" })
    : templates.verifyEmail({ name: "Gulnabi", url });

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <p style={{ margin: "0 0 12px" }}>
        {["verify", "reset", "welcome", "changed"].map((t) => (
          <a key={t} href={`?t=${t}`} style={{ marginRight: 12 }}>{t}</a>
        ))}
        <strong style={{ marginLeft: 12 }}>{email.subject}</strong>
      </p>
      <iframe title="preview" srcDoc={email.html} style={{ width: "100%", height: "80vh", border: "1px solid #ccc" }} />
    </div>
  );
}
