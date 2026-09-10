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

export type TrendSeries = { name: string; color: string; values: number[] };

/**
 * A line with the ground filled in under it.
 *
 * For a running total rather than a count per month: a roster only goes up,
 * and drawing that as twelve separate columns hides the shape of it. Bars
 * answer "how many in March", this answers "where is it heading".
 *
 * No smoothing, for the reason ScoreTrendChart gives: a curve through monthly
 * points invents readings between them that nobody recorded.
 */
export default function AreaTrendChart({
  labels, series, height = 200,
}: {
  labels: string[];
  series: TrendSeries[];
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 400,
      grid: { left: 34, right: 10, top: 12, bottom: 24 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category", boundaryGap: false, data: labels,
        axisLine: { lineStyle: { color: tokens.rule } },
        axisTick: { show: false },
        axisLabel: { color: tokens.inkMuted, fontSize: 10, fontFamily: "monospace" },
      },
      yAxis: {
        type: "value", minInterval: 1,
        splitLine: { lineStyle: { color: tokens.rule, type: "dashed" } },
        axisLabel: { color: tokens.inkMuted, fontSize: 10, fontFamily: "monospace" },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: "line",
        data: s.values,
        smooth: false,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        // Only the first series gets a fill. Two stacked washes over each
        // other turn into a third colour that means nothing.
        areaStyle: i === 0 ? { color: s.color, opacity: 0.12 } : undefined,
      })),
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [labels, series]);

  return (
    <Stack spacing={1.25}>
      {series.length > 1 ? (
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          {series.map((s) => (
            <Stack key={s.name} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 10, height: 2.5, borderRadius: 1, flexShrink: 0,
                         backgroundColor: s.color }} />
              <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                                letterSpacing: "0.06em", color: tokens.inkMuted }}>
                {s.name}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
      <Box ref={host} sx={{ width: "100%", height }} role="img"
           aria-label={series.map((s) => s.name).join(" and ") + " over time"} />
    </Stack>
  );
}
