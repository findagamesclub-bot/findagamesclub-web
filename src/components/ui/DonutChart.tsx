"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { display, mono, tokens } from "@/lib/tokens";

// Only what this chart draws, same as ScoreTrendChart. The full echarts bundle
// is an order of magnitude bigger.
echarts.use([PieChart, TooltipComponent, SVGRenderer]);

export type Slice = { key: string; label: string; value: number; color: string };

/**
 * A ring with the total in the middle, and its own legend under it.
 *
 * The legend is React rather than echarts so the figures can be set in the
 * same tabular mono as every other number in the app, and so the labels stay
 * selectable. It also carries the rule that colour alone must never be the
 * message: every slice is named and counted in text beside its swatch.
 */
export default function DonutChart({
  slices, centreValue, centreLabel, height = 190,
}: {
  slices: Slice[];
  centreValue: string;
  centreLabel: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const hasSlices = slices.some((s) => s.value > 0);

  useEffect(() => {
    const el = host.current;
    // Filtered in here rather than in render: a fresh array in the dependency
    // list tears the chart down and rebuilds it on every parent render.
    const drawn = slices.filter((s) => s.value > 0);
    if (!el || !drawn.length) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 400,
      tooltip: {
        trigger: "item",
        textStyle: { fontFamily: "var(--font-mono)", fontSize: 12 },
      },
      series: [{
        type: "pie",
        // Thick enough to read as a gauge, open enough for the total to sit
        // inside it without crowding the ring.
        radius: ["62%", "88%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          // A hairline of the page colour between segments, so two touching
          // slices read as two rather than as one long band.
          borderColor: tokens.paper, borderWidth: 2, borderRadius: 3,
        },
        emphasis: { scale: true, scaleSize: 4 },
        data: drawn.map((s) => ({ name: s.label, value: s.value,
                                  itemStyle: { color: s.color } })),
      }],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [slices]);

  return (
    <Stack spacing={1.5}>
      <Box sx={{ position: "relative", height,
                 // An empty ring is a grey circle with a zero in it, which
                 // reads as broken rather than as "nothing yet".
                 display: hasSlices ? "block" : "none" }}>
        <Box ref={host} sx={{ width: "100%", height: "100%" }} />
        {/* Over the ring rather than inside it as an echarts label: the total
            is the headline figure on this panel and belongs in the same type
            as every other headline figure. */}
        <Stack
          aria-hidden
          sx={{ position: "absolute", inset: 0, alignItems: "center",
                justifyContent: "center", pointerEvents: "none" }}>
          <Typography sx={{ fontFamily: display, fontWeight: 800, lineHeight: 1,
                            fontSize: "2rem", color: tokens.ink }}>
            {centreValue}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.14em", color: tokens.inkMuted, mt: 0.5 }}>
            {centreLabel.toUpperCase()}
          </Typography>
        </Stack>
      </Box>

      <Stack>
        {slices.map((s, i) => (
          <Stack key={s.key} direction="row" spacing={1.25}
            sx={{ alignItems: "center", py: 0.75,
                  borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}` }}>
            <Box sx={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                       backgroundColor: s.color }} />
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>{s.label}</Typography>
            <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums",
                              fontWeight: 700, fontSize: "0.85rem", color: tokens.ink }}>
              {s.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
