import "server-only";

import { Resend } from "resend";
import { LOGO_CID, LOGO_PNG_BASE64 } from "./logo-data";
import { UNSUBSCRIBE_SLOT } from "./templates/layout";

/**
 * Transactional email. Server-only so the API key can't reach the browser.
 * Without RESEND_API_KEY set, messages print to the console instead of sending,
 * so auth flows are testable before the sending domain is verified.
 */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  /** Improves deliverability. Derived from the HTML if omitted. */
  text?: string;
  replyTo?: string;
  /**
   * List-Unsubscribe and its One-Click partner, which is what makes Gmail and
   * Apple Mail show their own unsubscribe button. Providers also read it when
   * deciding whether this is bulk mail, so it earns its place on deliverability
   * alone.
   */
  headers?: Record<string, string>;
};

export type SendEmailResult =
  | { ok: true; id: string | null; delivery: "resend" | "console" }
  | { ok: false; error: string };

const FROM = process.env.EMAIL_FROM ?? "FindAGamesClub <onboarding@resend.dev>";

/**
 * The header logo, attached inline. Built once per process — the base64 is
 * ~21KB and every template uses the same shell.
 */
const LOGO_ATTACHMENT = {
  filename: "logo.png",
  content: LOGO_PNG_BASE64,
  contentType: "image/png",
  contentId: LOGO_CID,
} as const;

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getClient();

  // `deliver()` fills the unsubscribe slot; a receipt sent to an address typed
  // at checkout never goes through it, and there is nothing to unsubscribe
  // from. Stripped here so no path can ship the placeholder.
  input = { ...input, html: input.html.replace(UNSUBSCRIBE_SLOT, "") };

  if (!resend) {
    console.info(
      [
        "",
        "─── email (not sent: RESEND_API_KEY is not set) ───",
        `to      : ${Array.isArray(input.to) ? input.to.join(", ") : input.to}`,
        `from    : ${FROM}`,
        `subject : ${input.subject}`,
        "",
        input.text ?? stripHtml(input.html),
        "──────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { ok: true, id: null, delivery: "console" };
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? stripHtml(input.html),
    replyTo: input.replyTo,
    headers: input.headers,
    // Only when the template actually shows it, so a plain message isn't
    // carrying 21KB it never renders.
    attachments: input.html.includes(`cid:${LOGO_CID}`) ? [LOGO_ATTACHMENT] : undefined,
  });

  if (error) {
    console.error("email send failed", { subject: input.subject, error });
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id ?? null, delivery: "resend" };
}

/** Crude tag strip, only for deriving a text part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
