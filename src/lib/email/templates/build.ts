import { renderEmail, renderText, type LayoutOptions } from "./layout";

/**
 * Transactional email copy.
 *
 * Written in the interface's voice: say what happened, say what to do, no
 * apologies and no marketing. Subject lines describe the action, because that
 * is what people scan for in a crowded inbox.
 */

export type Email = { subject: string; html: string; text: string };

export function build(subject: string, options: LayoutOptions): Email {
  return { subject, html: renderEmail(options), text: renderText(options) };
}

/** "Hello Sam," when we know them, "Hello," when we do not. */
export function greet(name?: string): string {
  return name ? `Hello ${name},` : "Hello,";
}
