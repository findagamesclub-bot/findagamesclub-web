import { tokens } from "@/lib/tokens";

/**
 * The look every map on the site shares.
 *
 * Three maps drew their own pins and their own frame, and they drifted: the
 * directory used a 32px pin, the venue map a 38px one, and only two of the
 * three told you the wheel zooms. Kept here so a change lands everywhere and
 * they cannot come apart again.
 */

/** Club names are user data and this becomes markup, so it gets escaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * What a pin says on hover.
 *
 * A Leaflet tooltip rather than the browser's `title`, which waits a second,
 * cannot be styled, and never appears on a touch screen. Two lines: what it is
 * and where it is, which are the two things worth knowing before deciding to
 * click a pin.
 */
export function mapTooltipHtml(title: string, subtitle?: string | null): string {
  const sub = subtitle?.trim()
    ? `<span class="fagc-tip-sub">${escapeHtml(subtitle)}</span>`
    : "";
  return `<span class="fagc-tip-title">${escapeHtml(title)}</span>${sub}`;
}

export const TOOLTIP_OPTIONS = {
  direction: "top" as const,
  offset: [0, -20] as [number, number],
  opacity: 1,
  className: "fagc-tip",
};

/** The active pin is bigger because it is the one being read about. */
export const pinSize = (active: boolean) => (active ? 40 : 32);

export function mapPinHtml(label: string, colour: string, active = false): string {
  const size = pinSize(active);
  return `<span style="
    display:flex;align-items:center;justify-content:center;
    width:${size}px;height:${size}px;
    border-radius:50%;background:${colour};color:#fff;
    font-family:var(--font-display);font-weight:700;
    font-size:${active ? 15 : 13}px;
    border:${active ? 3 : 2}px solid #fff;
    box-shadow:0 ${active ? 3 : 1}px ${active ? 10 : 4}px rgba(16,27,45,.4);
    ">${label}</span>`;
}

/** Frame around the tiles. Height is the one thing a caller chooses. */
export const mapSurfaceSx = (height: { xs: number; md: number }) => ({
  height,
  borderRadius: 2,
  overflow: "hidden",
  border: `1px solid ${tokens.rule}`,
  bgcolor: tokens.surface,
  "& .leaflet-container": { fontFamily: "var(--font-display)" },

  // Leaflet's own tooltip is a bordered pale box with a hard arrow. Restyled to
  // the card treatment the rest of the site uses.
  "& .leaflet-tooltip.fagc-tip": {
    display: "block",
    padding: "8px 12px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: tokens.paper,
    boxShadow: "0 6px 20px rgba(16,27,45,0.18)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  },
  "& .leaflet-tooltip.fagc-tip .fagc-tip-title": {
    display: "block",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "0.95rem",
    lineHeight: 1.3,
    color: tokens.ink,
  },
  "& .leaflet-tooltip.fagc-tip .fagc-tip-sub": {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    letterSpacing: "0.04em",
    color: tokens.inkMuted,
    marginTop: "2px",
  },
  // The arrow is a bordered triangle by default, which shows as a stray notch
  // under the card unless it is recoloured to match.
  "& .leaflet-tooltip.fagc-tip.leaflet-tooltip-top:before": {
    borderTopColor: tokens.paper,
    marginBottom: "-1px",
  },
});

/** Says the wheel zooms, which is not obvious on an embedded map. */
export const MAP_HINT = "Scroll to zoom · drag to move";

export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_OPTIONS = {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 18,
};
