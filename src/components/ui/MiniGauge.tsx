"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import * as echarts from "echarts/core";
import { GaugeChart } from "echarts/charts";
import { SVGRenderer } from "echarts/renderers";
import { mono, tokens } from "@/lib/tokens";

echarts.use([GaugeChart, SVGRenderer]);

/**
 * How far along something is, as an arc.
 *
 * For a proportion with a finish line: scores settled, results matched, seats
 * taken. A run of months would be the wrong picture, because the question is
 * not when it happened but how much is left.
 *
 * The two ends are printed under it, so the arc never has to be estimated by
 * eye and the reader is told what the whole is.
 */
export default function MiniGauge({
  percent, done, left, doneLabel, leftLabel, colour, height = 74,
}: {
  percent: number;
  done: number;
  left: number;
  doneLabel: string;
  leftLabel: string;
  colour: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chart.setOption({
      animationDuration: 350,
      series: [{
        type: "gauge",
        // A half circle: it reads as a dial rather than as a broken ring, and
        // it fits a card's height without wasting the width.
        startAngle: 180, endAngle: 0,
        min: 0, max: 100,
        radius: "132%", center: ["50%", "88%"],
        progress: { show: true, width: 10, roundCap: true,
                    itemStyle: { color: colour } },
        axisLine: { lineStyle: { width: 10, color: [[1, tokens.rule]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          offsetCenter: [0, "-14%"],
          fontSize: 17, fontWeight: 700, fontFamily: "monospace",
          color: tokens.ink,
          formatter: "{value}%",
        },
        data: [{ value }],
      }],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [value, colour]);

  return (
    <Stack spacing={0.5}>
      <Box ref={host} sx={{ width: "100%", height }} role="img"
           aria-label={`${value} per cent. ${done} ${doneLabel}, ${left} ${leftLabel}.`} />
      <Stack direction="row" spacing={1.5} useFlexGap
        sx={{ flexWrap: "wrap", justifyContent: "center" }}>
        <Legend swatch={colour} value={done} label={doneLabel} />
        <Legend swatch={tokens.rule} value={left} label={leftLabel} />
      </Stack>
    </Stack>
  );
}

function Legend({ swatch, value, label }: { swatch: string; value: number; label: string }) {
  return (
    <Stack direction="row" spacing={0.625} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 8, height: 8, borderRadius: 0.5, flexShrink: 0,
                 backgroundColor: swatch }} />
      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", fontWeight: 700,
                        fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
      <Typography sx={{ fontFamily: mono, fontSize: "0.6rem",
                        letterSpacing: "0.06em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}
