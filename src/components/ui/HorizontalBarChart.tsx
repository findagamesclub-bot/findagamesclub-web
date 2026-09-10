"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { tokens } from "@/lib/tokens";

echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer]);

export type Row = { label: string; value: number; color?: string };

/**
 * A ranked list, drawn.
 *
 * Horizontal because the labels are names rather than dates: "Autumn Open" and
 * "Spring Escalation League" do not fit under a column and turning them
 * sideways makes a chart nobody reads. Vertical bars are for time.
 *
 * The figure is printed at the end of each bar, so the chart is still readable
 * as a table and colour is never the only thing carrying the answer.
 */
export default function HorizontalBarChart({
  rows, height, suffix = "",
}: {
  rows: Row[];
  height?: number;
  /** Printed after each figure, for example " tickets". */
  suffix?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  // Enough room per bar to stay legible, rather than a fixed box that squashes
  // ten rows and leaves white space under three.
  const tall = height ?? Math.max(120, rows.length * 34 + 16);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 400,
      grid: { left: 4, right: 56, top: 4, bottom: 4, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", show: false, minInterval: 1 },
      yAxis: {
        type: "category",
        // Biggest at the top, which is how a ranking is read.
        data: [...rows].reverse().map((r) => r.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: tokens.ink, fontSize: 12, width: 190,
                     overflow: "truncate" },
      },
      series: [{
        type: "bar",
        data: [...rows].reverse().map((r) => ({
          value: r.value,
          itemStyle: { color: r.color ?? tokens.brand, borderRadius: [0, 3, 3, 0] },
        })),
        barMaxWidth: 16,
        label: {
          show: true, position: "right", color: tokens.inkMuted,
          fontSize: 11, fontFamily: "monospace",
          formatter: (p: { value: number }) => `${p.value}${suffix}`,
        },
      }],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [rows, suffix]);

  return <Box ref={host} sx={{ width: "100%", height: tall }} role="img"
              aria-label={rows.map((r) => `${r.label}: ${r.value}`).join(", ")} />;
}
