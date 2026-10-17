import NextLink from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { initialsOf } from "@/utils/format";
import { display, mono, tokens } from "@/lib/tokens";

export type RankedRow = {
  label: string;
  value: number;
  /**
   * A second figure for the same row, set in mono beside the first.
   *
   * The ranking is by `value` and the note is whatever else is worth knowing
   * about it: what a product brought in against how many went, which is where
   * a club finds out that its best seller is not its best earner.
   */
  note?: string;
  /**
   * The list this row stands for.
   *
   * A ranking answers "how many" and the next question is always "which
   * ones", which the client asked in those words. Left off a row worth
   * nothing: a link to an empty list is a dead end wearing an affordance.
   */
  href?: string;
};

/**
 * A short ranking, drawn as rows rather than as a chart.
 *
 * `HorizontalBarChart` is an ECharts canvas with a 120px floor, which is right
 * for a ranking of ten and wrong for one of two: a club that meets on one night
 * got a single bar floating in the middle of an empty box, three times down the
 * page. These lists are at most five rows and the labels are the point, so they
 * are laid out as rows and the bar is a proportion under each one.
 *
 * Against the biggest row rather than the total, so the leader is always full
 * and the rest read as a share of it. A bar measured against a total nobody can
 * see says nothing.
 */
export default function RankedBars({
  rows, suffix, monograms = false, emphasiseLeader = true,
}: {
  rows: RankedRow[];
  /** What the figure counts, e.g. "bookings". Singularised at one. */
  suffix?: (value: number) => string;
  /** Initials in a circle, for rows that name a person. */
  monograms?: boolean;
  emphasiseLeader?: boolean;
}) {
  const top = Math.max(...rows.map((r) => r.value), 1);
  // Padded as a set rather than per row. Half of a loyalty ladder is usually
  // empty, so linking only the rows worth linking and padding only those
  // would draw a list whose spacing changed partway down.
  const linkable = rows.some((row) => row.href);

  return (
    <Stack spacing={monograms ? 2 : 1.5}>
      {rows.map((row, index) => {
        const lead = emphasiseLeader && index === 0;
        return (
          <Row key={row.label} href={row.href}>
          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "center",
                  // A link has to be worth aiming at on a phone. The rows
                  // themselves are about 33px, which is under the floor.
                  ...(linkable ? { py: 0.75 } : null),
                  ...(row.href ? {
                    borderRadius: 1,
                    transition: "background-color 150ms ease",
                    "&:hover": { backgroundColor: tokens.surface },
                  } : null) }}>
            {monograms ? (
              <Box aria-hidden sx={{
                flexShrink: 0, width: 34, height: 34, borderRadius: "50%",
                display: "grid", placeItems: "center",
                fontFamily: mono, fontSize: "0.7rem", fontWeight: 700,
                color: lead ? "#FFFFFF" : tokens.inkMuted,
                backgroundColor: lead ? tokens.brass : "transparent",
                border: `1px solid ${lead ? tokens.brass : tokens.rule}`,
              }}>
                {initialsOf(row.label)}
              </Box>
            ) : null}

            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1.5}
                sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                <Typography sx={{ fontFamily: display, fontWeight: 600,
                                  fontSize: "0.95rem", minWidth: 0,
                                  overflow: "hidden", textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" }}>
                  {row.label}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                  color: tokens.inkMuted, flexShrink: 0 }}>
                  {row.value}{suffix ? ` ${suffix(row.value)}` : ""}
                  {row.note ? ` · ${row.note}` : ""}
                </Typography>
              </Stack>

              <Box sx={{ height: 5, borderRadius: 3, overflow: "hidden",
                         backgroundColor: tokens.rule }}>
                {/* A floor of 4%, so a row worth 1 against a leader worth 40
                    is still a visible mark rather than an empty track. */}
                <Box sx={{ width: `${Math.max((row.value / top) * 100, 4)}%`,
                           height: "100%",
                           backgroundColor: lead ? tokens.brass : tokens.brand }} />
              </Box>
            </Stack>
          </Stack>
          </Row>
        );
      })}
    </Stack>
  );
}

/**
 * A row that leads somewhere, or the row on its own.
 *
 * A plain anchor, not `component={NextLink}`: these lists render from Server
 * Components and handing MUI a component reference throws at request time with
 * every static check green.
 */
function Row({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <NextLink href={href}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {children}
    </NextLink>
  );
}
