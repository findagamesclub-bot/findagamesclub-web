import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LongText from "@/components/ui/LongText";
import { historySummary } from "@/utils/submission-history";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";
import type { HistoryEntry } from "@/services/submissionReview.service";

/**
 * Everything that has been asked for, every time it was asked.
 *
 * `review_note` is one column, so each "send it back" overwrote the last and a
 * listing that went round three times showed the third note as though it were
 * the only one. Neither side could tell whether a club was working through the
 * list or going in circles.
 *
 * Newest first, because the question somebody opens this with is what the
 * current ask is; the ones underneath answer the second question, which is
 * whether this has been asked before. Every row carries its own date, so the
 * order is never something anybody has to infer.
 *
 * The rail is a hairline with a tinted dot per row. The line is structure, not
 * decoration, and the colour is on the dot, where it identifies what happened
 * rather than ornamenting an edge.
 *
 * The list itself does not scroll, and that is what lets each note scroll. The
 * first version capped both, which put a scrolling box inside a scrolling one
 * and is the nested scroll rule 9 is about. Capping only the list fixed the
 * nesting and hid five rounds of history behind one long note. So the list runs
 * to its full length, sits **after** the buttons it used to sit above (which is
 * what actually keeps Approve on screen), and each note is capped at nine lines
 * on its own. One scroll per note, none around them.
 */
export default function ReviewHistory({
  entries, noteLines = 9,
}: {
  entries: HistoryEntry[];
  /**
   * How many lines a note may run to before it scrolls. Zero for no cap.
   *
   * Nine where this list is the only thing scrolling, which is the sidebar on
   * the review screen. Zero inside a dialog, because the dialog body scrolls
   * already and a scrolling note inside a scrolling dialog is the nested scroll
   * rule 9 is about.
   */
  noteLines?: number;
}) {
  if (entries.length === 0) return null;

  const newestFirst = [...entries].reverse();

  const dotOf = (tone: string) =>
    tone === "good" ? tokens.positive
      : tone === "bad" ? tokens.danger
        : tone === "warn" ? tokens.brass : tokens.inkMuted;

  return (
    <Stack spacing={1.25}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
        {historySummary(entries.map((entry) => entry.kind))}
      </Typography>

      <Stack>
          {newestFirst.map((entry, index) => {
            const last = index === newestFirst.length - 1;
            return (
              <Stack key={entry.id} direction="row" spacing={1.5}
                sx={{ alignItems: "stretch" }}>
                {/* The rail: dot, then a hairline down to the next one. */}
                <Stack sx={{ alignItems: "center", width: 9, flexShrink: 0 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: "50%", mt: 0.55,
                             backgroundColor: dotOf(entry.tone), flexShrink: 0 }} />
                  {last ? null : (
                    <Box sx={{ width: "1px", flex: 1, backgroundColor: tokens.rule, mt: 0.5 }} />
                  )}
                </Stack>

                <Stack spacing={0.35} sx={{ minWidth: 0, pb: last ? 0 : 2 }}>
                  <Stack direction="row" spacing={0.75}
                    sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                      letterSpacing: "0.08em", color: tokens.ink }}>
                      {entry.label.toUpperCase()}
                    </Typography>
                    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                      color: tokens.inkMuted }}>
                      {[shortDate(entry.on.slice(0, 10)), entry.who]
                        .filter(Boolean).join(" · ")}
                    </Typography>
                  </Stack>

                  {/* Nine lines, then it scrolls. Enough that an ordinary note
                      never scrolls at all, and a pasted essay cannot push the
                      round before it a screen and a half down the page. A row
                      without a note says nothing rather than leaving an empty
                      line where words would be. */}
                  {entry.body
                    ? noteLines > 0
                      ? <LongText text={entry.body} lines={noteLines} />
                      : (
                        <Typography variant="body2"
                          sx={{ color: tokens.ink, whiteSpace: "pre-wrap" }}>
                          {entry.body}
                        </Typography>
                      )
                    : null}
                </Stack>
              </Stack>
            );
          })}
      </Stack>
    </Stack>
  );
}
