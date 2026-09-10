"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { tokens } from "@/lib/tokens";

echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer]);

/**
 * A card-sized run of months, with the months named.
 *
 * The unlabelled version of this said nothing: a reader could see three bars
 * and had no way to know whether they were the last three months or the first.
 * Only every third month is printed, which is enough to place the run without
 * turning the axis into twelve overlapping words.
 */
export default function MiniColumns({
  labels, values, colour, height = 74,
}: {
  labels: string[];
  values: number[];
  colour: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const last = values.length - 1;

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 350,
      grid: { left: 2, right: 2, top: 6, bottom: 18 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: {
        type: "category", data: labels,
        axisLine: { lineStyle: { color: tokens.rule } },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.inkMuted, fontSize: 9, fontFamily: "monospace",
          interval: (i: number) => i === last || i % 3 === 0,
        },
      },
      yAxis: { type: "value", show: false, minInterval: 1 },
      series: [{
        type: "bar", data: values, barMaxWidth: 12,
        // The month you are standing in is the one the figure above is about.
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: (p: { dataIndex: number }) =>
            p.dataIndex === last ? colour : `${colour}59`,
        },
      }],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [labels, values, colour, last]);

  return <Box ref={host} sx={{ width: "100%", height }} role="img"
              aria-label={labels.map((l, i) => `${l} ${values[i]}`).join(", ")} />;
}
