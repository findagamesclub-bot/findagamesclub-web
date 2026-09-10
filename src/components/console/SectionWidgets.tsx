import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MiniColumns from "@/components/ui/MiniColumns";
import MiniArea from "@/components/ui/MiniArea";
import MiniGauge from "@/components/ui/MiniGauge";
import MiniRanked from "@/components/ui/MiniRanked";
import SplitBar from "@/components/ui/SplitBar";
import MonoLabel from "@/components/ui/MonoLabel";
import { display, mono, tokens } from "@/lib/tokens";
import { WIDGET_GROUPS, type SectionWidget, type WidgetChart }
  from "@/services/consoleWidgets.service";

/**
 * Every section of the console, summarised, in the rail's own order.
 *
 * The grid that used to sit here listed the same twelve destinations as the
 * navigation beside it and said nothing about any of them. A card now carries
 * the one figure that section is about, the working behind it, and the shape
 * of the last twelve months, so the whole console can be read without opening
 * any of it.
 *
 * Grouped under the same headings as the rail so the two can be scanned
 * together rather than learned separately.
 */
export default function SectionWidgets({
  widgets, colour,
}: {
  widgets: SectionWidget[];
  /** The club's faction colour. It identifies the club, it does not decorate. */
  colour: string;
}) {
  if (!widgets.length) return null;

  return (
    <Stack spacing={3}>
      {WIDGET_GROUPS.map((group) => {
        const inGroup = widgets.filter((w) => w.group === group);
        if (!inGroup.length) return null;

        return (
          <Box key={group}>
            <MonoLabel>{group}</MonoLabel>
            {/* auto-fit rather than a fixed three, so a group of four sits on
                one row and a group of two shares one between them. Fixed
                columns left every short group with a ragged tail of empty
                paper, which reads as something failing to load. */}
            <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                       gridTemplateColumns: {
                         xs: "minmax(0, 1fr)",
                         sm: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
                       } }}>
              {inGroup.map((w) => <Card key={w.key} widget={w} colour={colour} />)}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

function Card({ widget, colour }: { widget: SectionWidget; colour: string }) {
  return (
    <NextLink href={widget.href} style={{ textDecoration: "none", color: "inherit" }}>
      <Stack
        sx={{ height: "100%", p: 2, borderRadius: 1.5, backgroundColor: tokens.paper,
              border: `1px solid ${widget.emphasis ? tokens.brass : tokens.rule}`,
              transition: "box-shadow 160ms ease, border-color 160ms ease",
              "&:hover": { boxShadow: "0 2px 14px rgba(16,27,45,0.08)",
                           borderColor: colour } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
          <Typography sx={{ flex: 1, fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.inkMuted }}>
            {widget.label.toUpperCase()}
          </Typography>
          <ChevronRightIcon sx={{ fontSize: 17, color: tokens.inkMuted, flexShrink: 0 }} />
        </Stack>

        <Typography sx={{ fontFamily: widget.value.length > 5 ? display : mono,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: widget.value.length > 8 ? "1.15rem" : "1.5rem",
                          fontWeight: 700, lineHeight: 1.15,
                          color: widget.emphasis ? tokens.brass : tokens.ink }}>
          {widget.value}
        </Typography>

        <Typography variant="body2"
          sx={{ color: tokens.inkMuted, fontSize: "0.82rem", mb: 1.25 }}>
          {widget.note}
        </Typography>

        {/* Pushed to the bottom, so the graphics line up across a row even when
            one card's note wraps onto a second line. */}
        <Box sx={{ mt: "auto" }}>
          <Chart chart={widget.chart} colour={colour} />
        </Box>
      </Stack>
    </NextLink>
  );
}

/** Whichever picture the section asked for. */
function Chart({ chart, colour }: { chart?: WidgetChart; colour: string }) {
  if (!chart) return null;

  switch (chart.kind) {
    case "columns":
      return <MiniColumns labels={chart.labels} values={chart.values} colour={colour} />;
    case "area":
      return <MiniArea labels={chart.labels} series={chart.series} />;
    case "gauge":
      return (
        <MiniGauge percent={chart.percent} done={chart.done} left={chart.left}
          doneLabel={chart.doneLabel} leftLabel={chart.leftLabel} colour={colour} />
      );
    case "ranked":
      return <MiniRanked rows={chart.rows} colour={colour} />;
    case "split":
      // The full SplitBar, legend included. The stripped-down version this
      // replaced drew four colours and named none of them.
      return <SplitBar parts={chart.parts} height={9} />;
  }
}
