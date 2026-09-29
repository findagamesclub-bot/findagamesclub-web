import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LinkButton from "@/components/ui/LinkButton";
import MetaRows from "@/components/meta/MetaRows";
import type { Depth, Faction } from "@/services/meta.service";
import { mono, tokens } from "@/lib/tokens";

/** One row of cards per ranking, in a column that fits three. */
const TOP = 3;

/** The top six, with a heading that says so when there are more. */
function Group({ title, shown, total, children }: {
  title: string;
  shown: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "baseline", justifyContent: "space-between",
              borderBottom: `1px solid ${tokens.rule}`, pb: 0.75 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {title}
        </Typography>
        {total > shown ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                            color: tokens.inkMuted, whiteSpace: "nowrap" }}>
            {`TOP ${shown} OF ${total}`}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Stack>
  );
}

/**
 * What this club plays, and how it goes.
 *
 * The client asked for it by name: "Club Faction and Disposition analytics
 * (missing from M2). Each club should show analytics based on the army
 * factions played and dispositions ... Local app has this, see Didcot club."
 *
 * Three factions and three dispositions, then a link into the tracker already
 * narrowed to this club. A club page is a summary; the tracker is where you
 * ask a follow-up question.
 *
 * Six of each was two rows per ranking, so the section ran to four rows of
 * cards on a page that has fourteen other sections. The whole ranking is one
 * press away, and a panel that prints most of what is behind the button is a
 * reason not to press it.
 *
 * The two rankings are stacked, not side by side. Side by side they were two
 * three-across grids inside a column that is already narrower than the page,
 * which is six columns of cards: "Astra Militarum" wrapped onto two lines and
 * every detachment under a disposition truncated to "Armour...". A card needs
 * about a third of this column to hold a faction name, and there is only one
 * third to go round, so they take turns.
 */
export default function ClubFactionMeta({
  clubId, clubName, factions, dispositions,
}: {
  clubId: number;
  clubName: string;
  factions: Faction[];
  dispositions: Depth[];
}) {
  if (factions.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {`Nothing recorded yet. A game counts here once ${clubName} has confirmed `
          + "the result and somebody has said what they played."}
      </Typography>
    );
  }

  // `games` on a faction row is one SIDE of a game, so summing it across
  // factions counts every game twice and called the total "scored games".
  // `appearances` is one army somebody brought, which is what this panel is
  // about, and it is the same figure the tracker's scope picker prints beside
  // the club's name, so the two now agree instead of differing by nine.
  const armies = factions.reduce((n, f) => n + f.appearances, 0);
  const topFactions = factions.slice(0, TOP);
  const topDispositions = dispositions.slice(0, TOP);

  return (
    <Stack spacing={3}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
        {`${armies} ${armies === 1 ? "army" : "armies"} recorded across `
          + `${factions.length} ${factions.length === 1 ? "faction" : "factions"}.`}
      </Typography>

      <Group title="FACTIONS" shown={topFactions.length} total={factions.length}>
        <MetaRows
          rows={topFactions.map((f) => ({
            label: f.label, winRate: f.winRate, games: f.games,
            earlySignal: f.earlySignal,
            note: `${f.representation}% of what was taken`,
          }))}
          perPage={TOP}
          paged={false}
          empty="No factions yet"
          emptyNote="They appear once a confirmed result says what was played." />
      </Group>

      <Group title="DISPOSITIONS" shown={topDispositions.length}
        total={dispositions.length}>
        <MetaRows
          rows={topDispositions.map((d) => ({
            label: d.label, parent: d.parent, winRate: d.winRate,
            games: d.games, earlySignal: d.earlySignal,
          }))}
          perPage={TOP}
          paged={false}
          empty="No dispositions yet"
          emptyNote="A disposition is recorded with the detachment it was played under." />
      </Group>

      {/* Rule 2: the way on from a summary is the point of the summary, and a
          small outlined link at the bottom of two grids is something to miss.
          Full width on a phone, where it is the only thing to press. */}
      <Box sx={{ pt: 0.5 }}>
        <LinkButton variant="contained" endIcon={<ArrowForwardIcon />}
          href={`/meta-tracker?scope=${clubId}&lens=all`}
          sx={{ width: { xs: "100%", sm: "auto" } }}>
          {`The full meta for ${clubName}`}
        </LinkButton>
      </Box>
    </Stack>
  );
}
