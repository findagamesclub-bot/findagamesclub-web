import Box from "@mui/material/Box";
import { tokens } from "@/lib/tokens";

/**
 * The client's dice mark, redrawn as vector.
 *
 * Their supplied PNG is 2000x1247 with the wordmark set through the middle of
 * the dice. Scaled into a 68px header the lettering lands around 4px tall, so
 * the artwork is split: the two dice become this mark, and the wordmark is set
 * in type beside it. Same identity, legible at every size.
 *
 * The two dice sit corner to corner on the diagonal rather than overlapping —
 * at small sizes an overlap turns into a smudge, and the gap keeps both shapes
 * readable down to a favicon.
 */
type Props = {
  /** A number, or MUI breakpoint values — the header runs smaller on mobile. */
  size?: number | Record<string, number>;
  onDark?: boolean;
};

export default function BrandMark({ size = 40, onDark = false }: Props) {
  // brandDeep is only a few steps off the ink background, so on the dark panels
  // the first die all but disappears and the mark reads as one die plus stray
  // dots. Both fills step up a shade there.
  const first = onDark ? tokens.brand : tokens.brandDeep;
  const second = onDark ? "#5B93CC" : tokens.brand;

  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
      sx={{ width: size, height: size, display: "block", flexShrink: 0 }}
    >
      <rect x="0.5" y="0.5" width="25" height="25" rx="5.5" fill={first} />
      <g fill="#FFFFFF">
        <circle cx="7" cy="7" r="2.8" />
        <circle cx="19" cy="7" r="2.8" />
        <circle cx="13" cy="13" r="2.8" />
        <circle cx="7" cy="19" r="2.8" />
        <circle cx="19" cy="19" r="2.8" />
      </g>

      <path d="M33.5 19 L48 33.5 L33.5 48 L19 33.5 Z" fill={second} />
      {/* Four pips set as a diamond, echoing the die they sit in. Three in a
          row plus one below — the arrangement on the client's PNG — bunched
          into the lower half and read as a smudge once the mark got bigger. */}
      <g fill="#FFFFFF">
        <circle cx="33.5" cy="28" r="2.6" />
        <circle cx="39" cy="33.5" r="2.6" />
        <circle cx="33.5" cy="39" r="2.6" />
        <circle cx="28" cy="33.5" r="2.6" />
      </g>
    </Box>
  );
}
