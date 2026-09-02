"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { TrendPoint } from "@/utils/member-stats";

// Only what this chart draws. The full echarts bundle is an order of magnitude
// bigger and every other chart in it would be dead weight.
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

/**
 * Scores for and against, over recent games.
 *
 * SVG rather than canvas: it stays sharp on a retina screen, scales with the
 * page, and the whole series is a dozen points, which is nowhere near where
 * canvas starts to win.
 *
 * The two lines are told apart by more than colour: solid against dashed, and
 * both named in the legend, so it still reads for somebody who cannot separate
 * red from blue.
 */
export default function ScoreTrendChart({
  points, mineLabel = "You",
}: {
  points: TrendPoint[];
  /**
   * Who the solid line belongs to. It defaults to "You" because the dashboard
   * was the first caller, but on somebody else's profile "You" names the wrong
   * person and quietly reverses the whole chart.
   */
  mineLabel?: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || points.length < 2) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 300,
      grid: { left: 40, right: 12, top: 30, bottom: 28 },
      legend: {
        top: 0, left: 0, itemGap: 18,
        textStyle: { fontFamily: "var(--font-mono)", fontSize: 11, color: tokens.inkMuted },
      },
      tooltip: {
        trigger: "axis",
        textStyle: { fontFamily: "var(--font-mono)", fontSize: 12 },
      },
      xAxis: {
        type: "category",
        data: points.map((p) => shortDate(p.date) ?? ""),
        axisLine: { lineStyle: { color: tokens.rule } },
        axisTick: { show: false },
        axisLabel: { fontFamily: "var(--font-mono)", fontSize: 10, color: tokens.inkMuted },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: tokens.rule } },
        axisLabel: { fontFamily: "var(--font-mono)", fontSize: 10, color: tokens.inkMuted },
      },
      series: [
        {
          // Not smoothed. A spline between two match scores invents values
          // that were never played: the curve bulged past 78 between a 78 and
          // a 15, reading as a game that did not happen.
          name: mineLabel, type: "line",
          data: points.map((p) => p.mine),
          lineStyle: { width: 2.5, color: tokens.brand },
          itemStyle: { color: tokens.brand },
          symbolSize: 7,
        },
        {
          name: "Opponent", type: "line",
          data: points.map((p) => p.theirs),
          lineStyle: { width: 2, color: tokens.brass, type: "dashed" },
          itemStyle: { color: tokens.brass },
          symbolSize: 6,
        },
      ],
    });

    // The chart has no layout of its own, so it has to be told when its box
    // changes: a sidebar opening or a phone turning would otherwise leave it
    // drawn at the old width.
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [points, mineLabel]);

  // One point is not a trend, and an axis with a single dot on it reads as a
  // broken chart rather than as "not enough games yet".
  if (points.length < 2) {
    return (
      <Box sx={{ py: 3, textAlign: "center", fontFamily: mono, fontSize: "0.78rem",
                 color: tokens.inkMuted }}>
        Scores appear here once two of your games have been scored.
      </Box>
    );
  }

  return <Box ref={host} sx={{ width: "100%", height: { xs: 220, md: 260 } }} />;
}
