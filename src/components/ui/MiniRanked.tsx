"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { tokens } from "@/lib/tokens";

echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer]);

export type RankedRow = { label: string; value: number };

/**
 * A card-sized ranking, with the things ranked actually named.
 *
 * Horizontal because the labels are event and competition names. The bars
 * before this carried no names at all, so three brown blocks were the whole
 * message. Long names are truncated by echarts and the full one is in the
 * tooltip and the accessible label.
 */
export default function MiniRanked({
  rows, colour, max = 3,
}: {
  rows: RankedRow[];
  colour: string;
  /** Beyond three a card stops being a card. */
  max?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const shown = rows.slice(0, max);
  const height = Math.max(46, shown.length * 22 + 8);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 350,
      grid: { left: 0, right: 26, top: 2, bottom: 2, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", show: false, minInterval: 1 },
      yAxis: {
        type: "category",
        // Biggest at the top, which is how a ranking is read.
        data: [...shown].reverse().map((r) => r.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: tokens.inkMuted, fontSize: 10, width: 96,
                     overflow: "truncate" },
      },
      series: [{
        type: "bar",
        data: [...shown].reverse().map((r) => r.value),
        barMaxWidth: 9,
        itemStyle: { color: colour, borderRadius: [0, 2, 2, 0] },
        label: {
          show: true, position: "right", color: tokens.inkMuted,
          fontSize: 10, fontFamily: "monospace",
        },
      }],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [shown, colour]);

  return <Box ref={host} sx={{ width: "100%", height }} role="img"
              aria-label={shown.map((r) => `${r.label}: ${r.value}`).join(", ")} />;
}
