import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkButton from "@/components/ui/LinkButton";
import MetaRows from "@/components/meta/MetaRows";
import type { Depth } from "@/services/meta.service";
import { PER_PAGE } from "@/utils/paging";
import { mono, tokens } from "@/lib/tokens";

/**
 * What was taken to this event.
 *
 * The client's words: "show overview of what armies are being/were taken to
 * the event and win rate percentage per army faction and disposition taken.
 * If the event is not warhammer 40k, this should be hidden."
 *
 * The win rates are honest about being empty. An event's results come from its
 * rounds, and the draw has no army screen yet (DEFERRED.md), so today this
 * answers what people brought. Printing 0% instead would say every army lost.
 *
 * Two shapes, one component. `top` cuts it to a few cards for the event page,
 * because a fifty-player RTT is fifty armies and the event page has six other
 * sections under it; without `top` it is the whole list, paged, which is what
 * the armies page renders.
 */
export default function EventArmyMeta({ rows, top, href }: {
  rows: Depth[];
  /** Cards to show before handing off to `href`. Absent means all of them. */
  top?: number;
  /** Where the rest live. Only drawn when there is a rest. */
  href?: string;
}) {
  const shown = top ? rows.slice(0, top) : rows;
  const more = rows.length - shown.length;
  const scored = shown.some((row) => row.winRate !== null);

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
        {rows.length
          ? `${rows.length} ${rows.length === 1 ? "army" : "armies"} recorded at this event.`
          : "Nothing recorded yet."}
      </Typography>

      <MetaRows
        rows={shown.map((row) => ({
          label: row.parent,
          parent: row.label || undefined,
          winRate: row.winRate,
          games: row.games,
          earlySignal: row.earlySignal,
          note: `${row.appearances} taken`,
        }))}
        noun="armies"
        perPage={top ?? PER_PAGE.cards}
        paged={!top}
        empty="No armies recorded yet"
        emptyNote="An army appears here once a finishing place or a table in the draw says what somebody played." />

      {shown.length && !scored ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Win rates need scored tables from the draw. These are the armies that
          were brought, taken from the finishing places.
        </Typography>
      ) : null}

      {href && more > 0 ? (
        <Box sx={{ pt: 0.5 }}>
          <LinkButton variant="contained" endIcon={<ArrowForwardIcon />} href={href}
            sx={{ width: { xs: "100%", sm: "auto" } }}>
            {`All ${rows.length} armies`}
          </LinkButton>
        </Box>
      ) : null}
    </Stack>
  );
}
