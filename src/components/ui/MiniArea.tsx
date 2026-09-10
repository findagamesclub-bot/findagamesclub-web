"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { mono, tokens } from "@/lib/tokens";

echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);

export type MiniSeries = { name: string; color: string; values: number[] };

/**
 * A card-sized line, with the months named and the lines named.
 *
 * For a shape rather than a set of separate months: growth, or two quantities
 * moving against each other. The key is set in React because echarts measures
 * text on a canvas and cannot resolve var(--font-mono), so its own legend
 * spaces the entries for the wrong font and they overlap.
 */
export default function MiniArea({
  labels, series, height = 74,
}: {
  labels: string[];
  series: MiniSeries[];
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const last = labels.length - 1;

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 350,
      grid: { left: 2, right: 4, top: 6, bottom: 18 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category", boundaryGap: false, data: labels,
        axisLine: { lineStyle: { color: tokens.rule } },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.inkMuted, fontSize: 9, fontFamily: "monospace",
          interval: (i: number) => i === last || i % 3 === 0,
        },
      },
      yAxis: { type: "value", show: false, minInterval: 1 },
      series: series.map((s, i) => ({
        name: s.name, type: "line", data: s.values,
        // No smoothing: a curve through monthly points invents readings
        // between them that nobody recorded.
        smooth: false, symbol: "none",
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        areaStyle: i === 0 ? { color: s.color, opacity: 0.14 } : undefined,
      })),
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [labels, series, last]);

  return (
    <Stack spacing={0.75}>
      {series.length > 1 ? (
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          {series.map((s) => (
            <Stack key={s.name} direction="row" spacing={0.625} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 9, height: 2.5, borderRadius: 1, flexShrink: 0,
                         backgroundColor: s.color }} />
              <Typography sx={{ fontFamily: mono, fontSize: "0.6rem",
                                letterSpacing: "0.06em", color: tokens.inkMuted }}>
                {s.name}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
      <Box ref={host} sx={{ width: "100%", height }} role="img"
           aria-label={series.map((s) => s.name).join(" and ")} />
    </Stack>
  );
}
