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

/**
 * Faction colours. Every club is assigned one from its slug, so a club keeps
 * the same colour on every card, page and list it appears in — the way an army
 * keeps its heraldry. Decorative colour would be noise; this one identifies.
 *
 * All six are tested against white text at 4.5:1.
 */
export const factions = [
  { key: "crimson", base: "#9E2A2B", deep: "#6E1C1D", soft: "#F7E4E4" },
  { key: "moss", base: "#2F6B4F", deep: "#1F4835", soft: "#DFEDE5" },
  { key: "indigo", base: "#3E3A8C", deep: "#2A2762", soft: "#E5E4F5" },
  { key: "rust", base: "#A8542A", deep: "#74391C", soft: "#F8E7DC" },
  { key: "teal", base: "#1E6B72", deep: "#134950", soft: "#DCECEE" },
  { key: "plum", base: "#6B2D5C", deep: "#481E3E", soft: "#F2E2EE" },
] as const;

export type Faction = (typeof factions)[number];

/**
 * Header height. The auth split panel sizes itself against this, so it lives
 * here rather than being typed into both files and quietly drifting apart.
 */
export const headerHeight = { xs: 60, md: 78 } as const;

export const mono = "var(--font-mono), ui-monospace, monospace";
export const display = "var(--font-display), system-ui, sans-serif";
export const body = "var(--font-body), Georgia, serif";

/**
 * A gaming table's grid, held back to a whisper. Repeated on every dark
 * ground — club art, the directory hero, the board masthead — so those
 * surfaces read as the same material rather than three different dark boxes.
 */
export const matGrid = (opacity = 0.055) =>
  `repeating-linear-gradient(0deg, rgba(255,255,255,${opacity}) 0 1px, transparent 1px 44px),
   repeating-linear-gradient(90deg, rgba(255,255,255,${opacity}) 0 1px, transparent 1px 44px)`;

/** The Counter plate. 44 on desktop, 40 on mobile, per the design system. */
export const counterSize = { xs: 40, sm: 44 } as const;

/**
 * Loyalty tier metals.
 *
 * Legacy names a `tone` per tier (club_store.py:63) and clubs use them: Didcot
 * has invented a sixth tier called Rock Star on "rainbow". These are the only
 * place in the app where colour means rank rather than identity, which is why
 * they are a closed set with a fallback rather than a free colour field.
 */
export const metals = {
  bronze:   { base: "#8C5A2B", deep: "#5E3A18", soft: "#F3E6D8", ink: "#5E3A18" },
  silver:   { base: "#7A8794", deep: "#4E5A66", soft: "#EDF1F5", ink: "#3D4854" },
  gold:     { base: "#B8862B", deep: "#8A6318", soft: "#F6EBD4", ink: "#5C4310" },
  platinum: { base: "#5C7C8A", deep: "#3B5561", soft: "#E4EEF2", ink: "#2E434D" },
  legend:   { base: "#6B2D5C", deep: "#481E3E", soft: "#F2E2EE", ink: "#481E3E" },
  rainbow:  { base: "#1E6B72", deep: "#134950", soft: "#DCECEE", ink: "#134950" },
  navy:     { base: "#174B8A", deep: "#0E2F57", soft: "#DCECFF", ink: "#0E2F57" },
  emerald:  { base: "#2F6B4F", deep: "#1F4835", soft: "#DFEDE5", ink: "#1F4835" },
  rose:     { base: "#9E2A2B", deep: "#6E1C1D", soft: "#F7E4E4", ink: "#6E1C1D" },
} as const;

export type MetalTone = keyof typeof metals;

/** A club can type anything into `tone`; unknown ones fall back to bronze. */
export function metalOf(tone: string | null | undefined) {
  const key = String(tone ?? "").trim().toLowerCase() as MetalTone;
  return metals[key] ?? metals.bronze;
}
