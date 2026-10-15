import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import RemoveIcon from "@mui/icons-material/Remove";
import { change, changeWords } from "@/utils/site-growth";
import { visuallyHidden } from "@/lib/a11y";
import { mono, tokens } from "@/lib/tokens";

/**
 * One figure, and what it was last time.
 *
 * The whole point of this screen. "41 clubs" is a measurement; growth is a
 * comparison, and a dashboard that prints the first and calls it the second is
 * answering a different question from the one it was asked.
 *
 * The direction is said three ways on purpose: an arrow, a percentage and a
 * sentence. Colour never carries it alone, and a percentage on its own is the
 * thing somebody misreads at a glance when the figure underneath is 2.
 */
export default function GrowthStat({
  label, value, before, format, noun,
}: {
  label: string;
  value: number;
  before: number;
  /** Counts print themselves; money goes through `pricePence`. */
  format?: (value: number) => string;
  /** "month", "quarter", "year" — what the window before this one was. */
  noun: string;
}) {
  const moved = change(value, before);
  const show = format ?? ((n: number) => n.toLocaleString("en-GB"));

  const Arrow = moved.direction === "up" ? ArrowUpwardIcon
    : moved.direction === "down" ? ArrowDownwardIcon : RemoveIcon;
  const tone = moved.direction === "up" ? tokens.positive
    : moved.direction === "down" ? tokens.danger : tokens.inkMuted;

  return (
    <Stack spacing={0.4}>
      <Typography sx={{ fontFamily: mono, fontSize: "1.65rem", fontWeight: 700,
                        lineHeight: 1 }}>
        {show(value)}
      </Typography>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.09em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", pt: 0.25 }}>
        <Arrow aria-hidden sx={{ fontSize: 14, color: tone, flexShrink: 0 }} />
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tone }}>
          {moved.direction === "flat" ? "no change"
            : moved.percent === null ? "new" : `${moved.percent}%`}
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tokens.inkMuted }}>
          {`· was ${show(moved.before)}`}
        </Typography>
        {/* The arrow and the colour are a glance; this is the fact. */}
        <Typography component="span" sx={visuallyHidden}>
          {changeWords(moved, noun)}
        </Typography>
      </Stack>
    </Stack>
  );
}
