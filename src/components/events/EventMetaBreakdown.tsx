import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MetaRows from "@/components/meta/MetaRows";
import { standouts } from "@/utils/event-standouts";
import type { EventBreakdown, EventGroupRow } from "@/services/meta.service";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * How an event went, grouped the way a club reads it.
 *
 * The client, on the panel the date gate used to hide: *"the data doesn't look
 * correct or show the detail we need. The purpose of these analytics is to
 * show a grouping of the best to worst performing Factions, Detachments,
 * Dispositions and Match ups ... it seems too basic."*
 *
 * They were reading `meta_event`, which groups by the whole
 * `(faction, detachment, disposition)` triple. That answers what each person
 * brought and cannot answer "how did Sororitas do here": an event where
 * fifteen people brought Sororitas under four detachments is four rows that
 * each look like a minority army. These are the Meta Tracker's own four
 * questions scoped to one event, in the shape that screen already uses, so a
 * club reading both is reading one vocabulary.
 *
 * "Taken by N players" counts people. One person at one event has an army row
 * per table of the draw plus one on the podium, so a count of rows said a
 * field of eight was forty.
 */
export default function EventMetaBreakdown({ breakdown, top }: {
  breakdown: EventBreakdown;
  /** Rows per group before the list pages. Absent means page them all. */
  top?: number;
}) {
  const tiles = standouts(breakdown);
  const { factions, detachments, dispositions, matchups } = breakdown;
  const nothing = !factions.length && !detachments.length && !dispositions.length;

  if (!breakdown.loaded) {
    return (
      <Typography variant="body2" sx={{ color: tokens.danger }}>
        The event analytics would not load. Reload the page and try again.
      </Typography>
    );
  }

  if (nothing) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing recorded yet. An army appears here once a finishing place or a
        table in the draw says what somebody played.
      </Typography>
    );
  }

  const group = (
    title: string, note: string, rows: EventGroupRow[], noun: string,
  ) => (rows.length ? (
    <Stack spacing={1.25} key={title}>
      <Stack spacing={0.1}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {title.toUpperCase()}
        </Typography>
        <Typography variant="caption"
          sx={{ fontFamily: display, color: tokens.inkMuted }}>
          {note}
        </Typography>
      </Stack>
      <MetaRows
        rows={(top ? rows.slice(0, top) : rows).map((row) => ({
          label: row.label,
          parent: row.parent || undefined,
          winRate: row.winRate,
          games: row.games,
          earlySignal: row.earlySignal,
          // Both figures, because they answer different questions: how many
          // people brought it, and how many games it was actually scored in.
          note: `${row.players} ${row.players === 1 ? "player" : "players"}`,
        }))}
        noun={noun}
        perPage={top ?? 9}
        paged={!top}
        empty={`No ${noun} recorded`}
        emptyNote="Nothing at this event says what was played." />
    </Stack>
  ) : null);

  return (
    <Stack spacing={3}>
      {tiles.length ? (
        <Box sx={{ display: "grid", gap: 1.5,
                   gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))",
                                          md: "repeat(5, minmax(0, 1fr))" } }}>
          {tiles.map((tile) => (
            <Stack key={tile.label} spacing={0.2}
              sx={{ p: 1.5, borderRadius: 1.5, backgroundColor: tokens.paper,
                    border: `1px solid ${tokens.rule}` }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {tile.label.toUpperCase()}
              </Typography>
              <Typography sx={{ fontFamily: display, fontWeight: 700,
                                fontSize: "1.05rem", lineHeight: 1.2 }}>
                {tile.value}
              </Typography>
              <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                {tile.note}
              </Typography>
            </Stack>
          ))}
        </Box>
      ) : null}

      {group("Armies", "Best to worst, by win rate. A rate needs two scored games behind it.",
             factions, "armies")}
      {group("Detachments", "Under the army that fielded them.", detachments, "detachments")}
      {group("Dispositions", "Across every army that took them.", dispositions, "dispositions")}

      {matchups.length ? (
        <Stack spacing={1.25}>
          <Stack spacing={0.1}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              MATCH UPS
            </Typography>
            <Typography variant="caption"
              sx={{ fontFamily: display, color: tokens.inkMuted }}>
              Who met whom across the draw, and how it went for the first named.
            </Typography>
          </Stack>
          <MetaRows
            rows={(top ? matchups.slice(0, top) : matchups).map((row) => ({
              label: row.label,
              parent: `against ${row.opponent}`,
              winRate: row.winRate,
              games: row.games,
              earlySignal: row.earlySignal,
            }))}
            noun="match ups"
            perPage={top ?? 9}
            paged={!top}
            empty="No match ups yet"
            emptyNote="A match up needs a scored table with an army on both sides." />
        </Stack>
      ) : null}
    </Stack>
  );
}
