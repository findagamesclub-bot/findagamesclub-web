import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { counterSize, tokens, type Faction } from "@/lib/tokens";

/**
 * The leading plate on every list row.
 *
 * Wargamers already have a word for a small marker that names a thing on the
 * table. Type is read from silhouette and content, never from hue — square is
 * a thing, circle is a person, dashed is an unfilled slot. That is what lets
 * fourteen object types feel like one app, and it is colourblind-safe by
 * construction because shape and figure carry the meaning.
 */
export type CounterKind = "thing" | "person" | "slot";

export default function Counter({
  kind = "thing", faction, primary, secondary, tone = "soft",
}: {
  kind?: CounterKind;
  faction: Faction;
  /** The figure. A count, a monogram, a short code. */
  primary: string;
  /** The tiny label under it. Usually three or four letters. */
  secondary?: string;
  /** `soft` sits on paper; `dark` sits on the mat. */
  tone?: "soft" | "dark" | "solid";
}) {
  const ground =
    tone === "dark" ? tokens.ink : tone === "solid" ? faction.base : faction.soft;
  const ink =
    tone === "soft" ? faction.deep : "#FFFFFF";

  return (
    <Box
      aria-hidden
      sx={{
        width: counterSize,
        height: counterSize,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: kind === "person" ? "50%" : 1,
        backgroundColor: kind === "slot" ? "transparent" : ground,
        border: kind === "slot" ? `2px dashed ${faction.base}` : "none",
        color: kind === "slot" ? faction.deep : ink,
        lineHeight: 1,
      }}
    >
      <Typography
        sx={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: primary.length > 3 ? "0.72rem" : "0.98rem",
          lineHeight: 1,
        }}
      >
        {primary}
      </Typography>
      {secondary ? (
        <Typography
          sx={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.53rem",
            letterSpacing: "0.1em",
            opacity: 0.72,
            lineHeight: 1,
            mt: 0.35,
          }}
        >
          {secondary.toUpperCase()}
        </Typography>
      ) : null}
    </Box>
  );
}
