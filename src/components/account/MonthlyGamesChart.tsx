"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { tokens } from "@/lib/tokens";
import type { MonthBucket } from "@/utils/member-form";

// Only what this chart draws, same as the other two.
echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

/**
 * A year of games, stacked by how they went.
 *
 * The gaps are as much of the answer as the bars: a member who played six
 * games in March and nothing since is looking at a different picture from one
 * who plays two a month, and a total of eighteen tells neither of them apart.
 *
 * Stacked rather than grouped, because the height of a column is "how much did
 * I play that month", which is the first question, and the split within it is
 * the second.
 */
export default function MonthlyGamesChart({ months }: { months: MonthBucket[] }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    const series = [
      { name: "Wins", key: "won" as const, color: tokens.positive },
      { name: "Draws", key: "drawn" as const, color: tokens.inkMuted },
      { name: "Losses", key: "lost" as const, color: tokens.danger },
      { name: "Not scored", key: "unscored" as const, color: tokens.rule },
    ];

    chart.setOption({
      animationDuration: 400,
      grid: { left: 30, right: 8, top: 34, bottom: 24 },
      legend: {
        top: 0, left: 0, itemGap: 16, itemWidth: 10, itemHeight: 10,
        icon: "roundRect",
        textStyle: { fontFamily: "var(--font-mono)", fontSize: 11, color: tokens.inkMuted },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        textStyle: { fontFamily: "var(--font-mono)", fontSize: 12 },
      },
      xAxis: {
        type: "category",
        data: months.map((m) => m.label),
        axisLine: { lineStyle: { color: tokens.rule } },
        axisTick: { show: false },
        axisLabel: { fontFamily: "var(--font-mono)", fontSize: 10, color: tokens.inkMuted },
      },
      yAxis: {
        type: "value",
        // Games are whole. A y-axis offering 0.5 of one is a chart drawn by
        // something that has never seen the data.
        minInterval: 1,
        splitLine: { lineStyle: { color: tokens.rule } },
        axisLabel: { fontFamily: "var(--font-mono)", fontSize: 10, color: tokens.inkMuted },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: "bar",
        stack: "games",
        barMaxWidth: 26,
        itemStyle: { color: s.color },
        // Rounded per column rather than per series: the cap belongs to
        // whichever segment happens to be on top that month, and a month with
        // no unscored games would otherwise come out flat.
        data: months.map((m) => {
          const topmost = series.reduce(
            (best, candidate, j) => (m[candidate.key] > 0 ? j : best), -1);
          return {
            value: m[s.key],
            ...(i === topmost
              ? { itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] } }
              : {}),
          };
        }),
      })),
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [months]);

  return <Box ref={host} sx={{ width: "100%", height: { xs: 200, md: 230 } }} />;
}
