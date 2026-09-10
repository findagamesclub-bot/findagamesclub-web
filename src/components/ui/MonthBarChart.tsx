"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { mono, tokens } from "@/lib/tokens";

// Only what this chart draws, same as the other three.
echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer]);

export type MonthSeries = { name: string; color: string; values: number[] };

/**
 * A run of months, one column per series.
 *
 * Grouped rather than stacked: tables booked and members joined are different
 * units, and stacking them would draw a total that means nothing. The account
 * dashboard's chart stacks because its parts are all games.
 *
 * The empty months are the point, so the axis always runs the full length even
 * when only two of twelve have anything in them.
 *
 * The key is React rather than echarts, for the reason DonutChart's is: echarts
 * measures label widths on a canvas and cannot resolve var(--font-mono), so it
 * spaces the entries for a narrower font than the one that renders and they
 * overlap. Setting it in the page's own type also makes it match every other
 * label on the console.
 */
export default function MonthBarChart({
  labels, series, height = 220,
}: {
  labels: string[];
  series: MonthSeries[];
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 400,
      grid: { left: 32, right: 8, top: 12, bottom: 24 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { lineStyle: { color: tokens.rule } },
        axisTick: { show: false },
        axisLabel: { color: tokens.inkMuted, fontSize: 10,
                     fontFamily: "var(--font-mono)" },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: tokens.rule, type: "dashed" } },
        axisLabel: { color: tokens.inkMuted, fontSize: 10,
                     fontFamily: "var(--font-mono)" },
      },
      series: series.map((s) => ({
        name: s.name,
        type: "bar",
        data: s.values,
        barMaxWidth: 18,
        itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] },
      })),
    });

    // The console column changes width when the rail opens or the window
    // moves, and ECharts sizes itself once unless told.
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
    // Rebuilt only when the data changes, not on every render: a fresh array
    // literal in the deps would tear the chart down and rebuild it each time.
  }, [labels, series]);

  return (
    <Stack spacing={1.25}>
      {series.length > 1 ? (
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          {series.map((s) => (
            <Stack key={s.name} direction="row" spacing={0.75}
              sx={{ alignItems: "center" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, flexShrink: 0,
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
           aria-label={series.map((s) => s.name).join(" and ") + " by month"} />
    </Stack>
  );
}
