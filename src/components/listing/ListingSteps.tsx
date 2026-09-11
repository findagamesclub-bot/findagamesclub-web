import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CheckIcon from "@mui/icons-material/Check";
import { mono, tokens } from "@/lib/tokens";

export type ListingStep = {
  slug: string;
  /** Legacy's own label. */
  label: string;
  /** The line underneath, which counts rather than describes. */
  status: string;
};

/**
 * Where you are in the listing, and how far off finished it is.
 *
 * Legacy prints "N of 8 required checks ready" over a track above its steps,
 * and a status under each one. Both are kept, because between them they answer
 * the only two questions somebody has here: what is left, and where is it.
 *
 * The track is the one place this screen raises its voice. Brass, because it
 * carries a figure rather than decorating a heading, which is the rule the rest
 * of the console follows. It is deliberately a hairline: a fat progress bar
 * would make an unfinished listing look broken rather than unfinished.
 */
export default function ListingSteps({
  steps, current, base, summary, fraction,
}: {
  steps: ListingStep[];
  /** The slug of the step being edited. */
  current: string;
  /** `/clubs/didcot/manage/listing` */
  base: string;
  summary: string;
  fraction: number;
}) {
  return (
    <Box component="nav" aria-label="Listing steps" sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.brass }}>
          {summary.toUpperCase()}
        </Typography>
      </Stack>

      <Box aria-hidden sx={{ height: 3, borderRadius: 999, backgroundColor: tokens.rule, mb: 2 }}>
        <Box sx={{ height: "100%", borderRadius: 999, backgroundColor: tokens.brass,
                   width: `${Math.round(fraction * 100)}%`,
                   transition: "width 200ms ease-out" }} />
      </Box>

      <Box sx={{ display: "grid", gap: 1,
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)",
                   sm: "repeat(2, minmax(0, 1fr))",
                   lg: `repeat(${steps.length}, minmax(0, 1fr))`,
                 } }}>
        {steps.map((step, index) => {
          const here = step.slug === current;
          const done = step.status.startsWith("Complete") || step.status.endsWith("complete");

          return (
            <NextLink key={step.slug} href={`${base}/${step.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
              aria-current={here ? "step" : undefined}>
              <Stack spacing={0.5}
                sx={{ px: 1.5, py: 1.25, borderRadius: 1.5, height: "100%",
                      border: `1px solid ${here ? tokens.brass : tokens.rule}`,
                      backgroundColor: here ? tokens.brassSoft : tokens.paper,
                      "&:hover": { borderColor: tokens.brass } }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  {/* The number is the step's identity, so it stays a number
                      even when the step is finished; the tick sits beside it
                      rather than replacing it. */}
                  <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", fontWeight: 700,
                                    color: here ? tokens.brass : tokens.inkMuted }}>
                    {index + 1}
                  </Typography>
                  <Typography sx={{ fontFamily: "var(--font-display)", fontSize: "0.9rem",
                                    fontWeight: here ? 700 : 600, flex: 1, minWidth: 0 }}>
                    {step.label}
                  </Typography>
                  {done ? (
                    <CheckIcon aria-label="complete"
                      sx={{ fontSize: 15, color: tokens.positive, flexShrink: 0 }} />
                  ) : null}
                </Stack>
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                  color: tokens.inkMuted, overflowWrap: "anywhere" }}>
                  {step.status}
                </Typography>
              </Stack>
            </NextLink>
          );
        })}
      </Box>
    </Box>
  );
}
