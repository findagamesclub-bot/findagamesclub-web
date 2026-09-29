"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

const STAGES = [
  { at: 0, said: "Reading the list" },
  { at: 6, said: "Working through the signals" },
  { at: 18, said: "Writing it up" },
];

/**
 * A run in progress.
 *
 * Time-based stages rather than a real percentage, because there is no real
 * percentage to report: the provider does not say how far through it is. What
 * it does say honestly is how long this has been going and roughly how long it
 * usually takes, so somebody can decide whether to wait.
 *
 * "You can leave this page" is the most useful line on it and is the reason
 * the whole thing is a job.
 */
export default function AiJobProgress({ startedAt }: { startedAt: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const began = new Date(startedAt).getTime();
    const tick = () => setSeconds(Math.max(0, Math.round((Date.now() - began) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const stage = [...STAGES].reverse().find((one) => seconds >= one.at) ?? STAGES[0];

  return (
    <Stack spacing={1.25}
      sx={{ p: 2, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.paper }}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
          {stage.said}
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.75rem", color: tokens.inkMuted }}>
          {`${seconds}s`}
        </Typography>
      </Stack>

      <Box>
        <LinearProgress sx={{ borderRadius: 2 }} />
      </Box>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Usually 20 to 40 seconds. You can leave this page; it carries on without
        you and the answer will be here when you come back.
      </Typography>
    </Stack>
  );
}
