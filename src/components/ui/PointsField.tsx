"use client";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { formatMoney } from "@/utils/format";
import { mono, tokens } from "@/lib/tokens";

/**
 * How much of this do you want to pay with points.
 *
 * One control, because it is one decision wherever it appears: a table
 * booking, event tickets, and now a coaching session. `TicketPointsField`
 * already carried a comment saying it was deliberately the same control and
 * the same wording as the booking desk, which is exactly the argument for
 * there being one of it rather than a third copy drifting away from the other
 * two.
 *
 * It renders nothing when there is nothing to offer. A disabled box with no
 * reason beside it is worse than no box: the member cannot tell whether they
 * are short of points, on the wrong tier, or looking at something free.
 *
 * Every figure here is a quote. The database recomputes all of it from the
 * club's settings and the member's balance at the moment of the write, so a
 * tampered field buys nothing.
 */
export default function PointsField({
  name = "points", held, max, value, pointsOff, currency = "GBP", onChange,
}: {
  /** The form field, so a server action can read it. */
  name?: string;
  /** What they hold at this club. */
  held: number;
  /** The most that may go towards this one thing. Zero renders nothing. */
  max: number;
  value: number;
  /** What the chosen points are worth, already priced by the caller. */
  pointsOff: number;
  currency?: string;
  onChange: (points: number) => void;
}) {
  if (max <= 0) return null;

  return (
    <Stack spacing={1.25}
      sx={{ p: 1.75, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.surface }}>
      <TextField
        size="small" type="number" label="Points to use" fullWidth
        name={name}
        value={value || ""}
        onChange={(event) =>
          onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))}
        helperText={`You have ${held.toLocaleString("en-GB")}. Up to ${max} on this one.`}
        slotProps={{ htmlInput: { min: 0, max } }}
      />

      {pointsOff > 0 ? (
        <Stack direction="row"
          sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <Typography variant="body2" sx={{ color: tokens.positive }}>
            {`${value} ${value === 1 ? "point" : "points"} off`}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.9rem",
                            color: tokens.positive, fontWeight: 700 }}>
            {`− ${formatMoney(pointsOff, currency)}`}
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
