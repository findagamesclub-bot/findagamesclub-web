import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { eventWhen } from "@/utils/event-when";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * When an event starts and when it finishes, in the club's own colour.
 *
 * One component for the event page and the map tile, so the two cannot drift
 * apart the way the wording already had once.
 *
 * The colour is the faction the club is assigned everywhere else, not a new
 * accent: `deep` on `soft` measures between 7.4:1 and 11:1 across all six, so
 * it clears AA for small text with room to spare. The arrow between the two is
 * `base`, which is a large glyph rather than text and only needs 3:1.
 *
 * Deliberately no play/stop icons. They read as media controls, and a control
 * that cannot be pressed is worse than no icon at all.
 */
export default function EventWhen({
  event, faction, dense = false,
}: {
  event: { startDate: string | null; startTime: string | null;
           endDate: string | null; endTime: string | null };
  faction: Faction;
  /** The map tile, where the panel sits inside an already-bordered card. */
  dense?: boolean;
}) {
  const { starts, ends } = eventWhen(event);
  if (!starts) return null;

  return (
    <Stack
      direction="row"
      spacing={dense ? 1 : 2}
      sx={{
        alignItems: "center",
        alignSelf: "flex-start",
        px: dense ? 1.5 : 2,
        py: dense ? 1.25 : 1.5,
        // A plain tint, no rule and no radius. The colour that identifies the
        // club is already carried by the labels; a bordered rounded panel on
        // top of that reads as a widget dropped onto the page.
        bgcolor: faction.soft,
      }}
    >
      <Field label="STARTS" value={starts} faction={faction} dense={dense} />

      {ends ? (
        <>
          <ArrowRightAltIcon aria-hidden
            sx={{ fontSize: dense ? 20 : 24, color: faction.base, flexShrink: 0 }} />
          <Field label="ENDS" value={ends} faction={faction} dense={dense} />
        </>
      ) : null}
    </Stack>
  );
}

function Field({ label, value, faction, dense }: {
  label: string; value: string; faction: Faction; dense: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem",
                        fontWeight: 700, letterSpacing: "0.14em",
                        color: faction.deep, mb: 0.3 }}>
        {label}
      </Typography>
      {/* Tabular figures, so a 09:30 and an 18:00 sit the same width apart. */}
      <Typography sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
                        fontSize: dense ? "0.82rem" : "1rem", fontWeight: 600,
                        lineHeight: 1.2, color: tokens.ink, whiteSpace: "nowrap" }}>
        {value}
      </Typography>
    </Box>
  );
}
