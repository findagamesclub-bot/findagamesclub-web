import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkButton from "@/components/ui/LinkButton";
import MetaRows from "@/components/meta/MetaRows";
import { PER_PAGE } from "@/utils/paging";
import { mono, tokens } from "@/lib/tokens";

export type MemberArmy = {
  factionId: string; label: string;
  games: number; wins: number; draws: number; losses: number;
  winRate: number | null; appearances: number; earlySignal: boolean;
};

/**
 * What this member plays, and how it goes.
 *
 * Only from results their club has confirmed, like everything else the tracker
 * counts, so a profile cannot flatter somebody with games nobody agreed to.
 * Empty for a reader who shares no club with them, which the policy on the
 * rows decides rather than this component.
 */
export default function MemberArmyInsights({
  armies, name, top, href,
}: {
  armies: MemberArmy[];
  name: string;
  /** Cards to show before handing off to `href`. Absent means all of them. */
  top?: number;
  /** Where the rest live. Only drawn when there is a rest. */
  href?: string;
}) {
  if (armies.length === 0) return null;

  // The totals count every army, not the six on screen: "27 of 53 games won"
  // is the true answer to how they have done, and cutting it to the top six
  // would make the panel disagree with the page behind the button.
  const games = armies.reduce((n, a) => n + a.games, 0);
  const wins = armies.reduce((n, a) => n + a.wins, 0);
  const shown = top ? armies.slice(0, top) : armies;
  const more = armies.length - shown.length;

  return (
    <Stack spacing={1.5}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
        {games
          ? `${wins} of ${games} confirmed ${games === 1 ? "game" : "games"} won, `
            + `across ${armies.length} ${armies.length === 1 ? "army" : "armies"}.`
          : `${armies.length} ${armies.length === 1 ? "army" : "armies"} recorded, `
            + "none of them scored yet."}
      </Typography>

      <MetaRows
        rows={shown.map((a) => ({
          label: a.label, winRate: a.winRate, games: a.games,
          earlySignal: a.earlySignal,
          note: `${a.wins}W ${a.draws}D ${a.losses}L`,
        }))}
        perPage={top ?? PER_PAGE.cards}
        paged={!top}
        noun="armies"
        empty="Nothing recorded yet"
        emptyNote={`${name} has not had a result confirmed with an army on it.`} />

      {href && more > 0 ? (
        <Box sx={{ pt: 0.5 }}>
          <LinkButton variant="contained" endIcon={<ArrowForwardIcon />} href={href}
            sx={{ width: { xs: "100%", sm: "auto" } }}>
            {`All ${armies.length} armies`}
          </LinkButton>
        </Box>
      ) : null}
    </Stack>
  );
}
