/**
 * Design tokens. Deliberately NOT a client module.
 *
 * theme.ts carries "use client" because createTheme runs in the browser. Any
 * non-component export from a client module comes back undefined when a Server
 * Component imports it, which silently produced CSS like
 * `border-top: 1px solid undefined`. Tokens are plain data, so they live here
 * and both sides can read them.
 */

export const tokens = {
  ink: "#101B2D",
  inkMuted: "#4E5F79",
  brand: "#174B8A",
  brandDeep: "#0E2F57",
  brandSoft: "#DCECFF",
  brass: "#B8862B",
  brassSoft: "#F6EBD4",
  /** Brass lifted for legibility on dark backgrounds. */
  brassOnDark: "#D9A441",
  surface: "#F7F9FC",
  paper: "#FFFFFF",
  rule: "#DCE3EC",
  positive: "#1D6F4A",
  danger: "#B3261E",
} as const;

export const mono = "var(--font-mono), ui-monospace, monospace";
export const display = "var(--font-display), system-ui, sans-serif";
export const body = "var(--font-body), Georgia, serif";
