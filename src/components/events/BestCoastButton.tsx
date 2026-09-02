import Button from "@mui/material/Button";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { externalUrl } from "@/utils/external-url";
import { type Faction } from "@/lib/tokens";

/**
 * The club's Best Coast Pairings listing, where registration and pairings live.
 *
 * In the club's own colour rather than the default grey outline. Grey said
 * nothing and belonged to nothing; the faction is what every other piece of
 * this event already wears, so the button reads as part of the listing instead
 * of a control that happened to land there.
 *
 * Outlined, not filled, on purpose. It leaves the site, and the filled button
 * on any event surface is the one that sells a ticket.
 *
 * A plain anchor rather than MUI's `component` prop: this renders from Server
 * Components, and passing a component across that boundary is not
 * serializable. It is an external address anyway, so next/link has no part.
 */
export default function BestCoastButton({
  href, faction, size = "small",
}: {
  /** Whatever the club typed. Validated here; nothing renders if it is unusable. */
  href: string | null;
  faction: Faction;
  /**
   * "medium" on the event's own page, where it stands alone. "small" in a card,
   * where it sits in a row with two others and the filled one must stay the
   * loudest.
   */
  size?: "small" | "medium" | "large";
}) {
  const url = externalUrl(href);
  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: "none" }}>
      <Button
        size={size}
        variant="outlined"
        endIcon={<OpenInNewIcon
          sx={{ fontSize: size === "small" ? 15 : 17, opacity: 0.7 }} />}
        sx={{
          color: faction.deep,
          borderColor: faction.base,
          fontWeight: 600,
          whiteSpace: "nowrap",
          "&:hover": {
            borderColor: faction.deep,
            backgroundColor: faction.soft,
          },
        }}
      >
        Best Coast Pairings
      </Button>
    </a>
  );
}
