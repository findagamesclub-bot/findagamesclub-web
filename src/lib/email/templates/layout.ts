/**
 * Shared shell for transactional email.
 *
 * Email clients are stuck around 2005: tables for layout, inline styles only,
 * no flexbox or grid, and web fonts fail in Outlook and most desktop clients.
 * So the site's Archivo + Source Serif pairing becomes Arial + Georgia, which
 * keeps the same sans-display / serif-body relationship using fonts that are
 * actually present everywhere.
 */

import { LOGO_CID, LOGO_HEIGHT, LOGO_WIDTH } from "../logo-data";

export const brand = {
  ink: "#101B2D",
  inkMuted: "#4E5F79",
  blue: "#174B8A",
  blueDeep: "#0E2F57",
  brass: "#B8862B",
  surface: "#F7F9FC",
  paper: "#FFFFFF",
  rule: "#DCE3EC",
} as const;

const DISPLAY = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
const BODY = "Georgia, 'Times New Roman', serif";
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace";

export type LayoutOptions = {
  /** Small tracked label above the heading, e.g. "Confirm your email". */
  eyebrow: string;
  heading: string;
  /** Paragraphs of body copy. */
  body: string[];
  action?: { label: string; url: string };
  /** Shown under the button for people who can't click it. */
  fallbackNote?: string;
  /** Small print above the footer rule. */
  footnote?: string;
  previewText: string;
};

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(options: LayoutOptions): string {
  const { eyebrow, heading, body, action, fallbackNote, footnote, previewText } = options;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.surface};">
  <div style="display:none;font-size:1px;color:${brand.surface};max-height:0;overflow:hidden;">${esc(previewText)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${brand.surface};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

          <tr>
            <td style="padding:0 0 20px 4px;">
              <!-- Attached inline rather than linked: a hosted URL has to be
                   publicly reachable, and Gmail proxies images through its own
                   servers, so anything on localhost renders broken.
                   Most clients block images until the reader allows them, so
                   the alt text is the wordmark, not a description of it. -->
              <img src="cid:${LOGO_CID}" alt="FindAGamesClub"
                   width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}"
                   style="display:block;border:0;outline:none;text-decoration:none;font-family:${DISPLAY};font-size:15px;font-weight:bold;color:${brand.blueDeep};">
            </td>
          </tr>

          <tr>
            <td style="background:${brand.paper};border:1px solid ${brand.rule};border-radius:6px;padding:36px 32px;">

              <p style="margin:0 0 10px;font-family:${DISPLAY};font-size:11px;font-weight:bold;letter-spacing:0.14em;text-transform:uppercase;color:${brand.brass};">
                ${esc(eyebrow)}
              </p>

              <h1 style="margin:0 0 20px;font-family:${DISPLAY};font-size:26px;line-height:1.2;font-weight:bold;letter-spacing:-0.02em;color:${brand.ink};">
                ${esc(heading)}
              </h1>

              ${body
                .map(
                  (p) =>
                    `<p style="margin:0 0 16px;font-family:${BODY};font-size:16px;line-height:1.6;color:${brand.ink};">${esc(p)}</p>`,
                )
                .join("\n              ")}

              ${
                action
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px;">
                <tr>
                  <td style="background:${brand.blue};border-radius:4px;">
                    <a href="${esc(action.url)}" style="display:inline-block;padding:13px 26px;font-family:${DISPLAY};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">
                      ${esc(action.label)}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0;font-family:${BODY};font-size:13px;line-height:1.5;color:${brand.inkMuted};">
                ${esc(fallbackNote ?? "If the button does not work, copy this link into your browser:")}
              </p>
              <p style="margin:6px 0 0;font-family:${MONO};font-size:12px;line-height:1.5;color:${brand.blue};word-break:break-all;">
                ${esc(action.url)}
              </p>`
                  : ""
              }

              ${
                footnote
                  ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr><td style="border-top:1px solid ${brand.rule};padding-top:16px;">
                  <p style="margin:0;font-family:${BODY};font-size:13px;line-height:1.5;color:${brand.inkMuted};">${esc(footnote)}</p>
                </td></tr>
              </table>`
                  : ""
              }

            </td>
          </tr>

          <tr>
            <td style="padding:20px 4px 0;">
              <p style="margin:0;font-family:${DISPLAY};font-size:12px;line-height:1.6;color:${brand.inkMuted};">
                FindAGamesClub · Tabletop and wargaming clubs across the UK
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text alternative. Every email should have one; it improves deliverability. */
export function renderText(options: LayoutOptions): string {
  const lines = [
    options.eyebrow.toUpperCase(),
    "",
    options.heading,
    "",
    ...options.body,
  ];
  if (options.action) {
    lines.push("", options.action.label + ":", options.action.url);
  }
  if (options.footnote) lines.push("", options.footnote);
  lines.push("", "---", "FindAGamesClub · Tabletop and wargaming clubs across the UK");
  return lines.join("\n");
}
