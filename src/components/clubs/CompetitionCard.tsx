import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import NextLink from "next/link";
import CompetitionStandings from "./CompetitionStandings";
import CompetitionGames, { type PlayedGames } from "./CompetitionGames";
import { shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { Competition } from "@/types/competition";

/** One league, ladder or campaign. Legacy's showcase card (detail.js:5899). */
export default function CompetitionCard({
  competition, faction, played, href, anchorId,
}: {
  competition: Competition;
  faction: Faction;
  /**
   * Where the rounds and the results live, when this card is not already on
   * that page.
   *
   * The client, item 27: "can we allow the table and individual
   * league/campaign to be clickable to see the further details of the rounds
   * and results? The current design makes it hard to find how you get the
   * round details, as its hidden underneath these tables." The way in existed
   * and was one grey strip under every card on the page, which reads as a
   * footer rather than as the door.
   *
   * The HEADER carries the link and the standings table does not: the table's
   * rows already hold their own links, and an anchor around an anchor is
   * invalid HTML and a real bug rather than a layout opinion.
   */
  href?: string;
  /** So a link from elsewhere can land on this card. */
  anchorId?: string;
  /**
   * What was played in each game, where the page read it. The club page shows
   * three competitions and does not, so the control simply does not appear
   * there; the full results history page does.
   */
  played?: PlayedGames;
}) {
  const leader = competition.standings[0];
  const ran = [
    shortDate(competition.startDate),
    competition.endDate ? `${competition.isCompleted ? "ended" : "ends"} ${shortDate(competition.endDate)}` : null,
  ].filter(Boolean).join(" · ");

  const head = (
      <Stack spacing={1.25}
        sx={{ px: 2.5, py: 2.25,
              borderBottom: `1px solid ${tokens.rule}`,
              backgroundColor: competition.isCompleted ? tokens.surface : faction.soft,
              ...(href ? { "&:hover h4": { color: faction.deep } } : {}) }}>
        <Stack direction="row" spacing={1.5}
          sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: faction.deep }}>
              {[competition.typeLabel, competition.statusLabel]
                .filter(Boolean).join(" · ").toUpperCase()}
            </Typography>
            <Typography variant="h4" sx={{ fontSize: "1.15rem", lineHeight: 1.25 }}>
              {competition.title}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap
            sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            {competition.season ? (
              <Chip size="small" label={competition.season}
                sx={{ bgcolor: tokens.paper, fontWeight: 600 }} />
            ) : null}
            {competition.game ? (
              <Chip size="small" label={competition.game}
                sx={{ bgcolor: tokens.paper, fontWeight: 600,
                      textTransform: "capitalize" }} />
            ) : null}
          </Stack>
        </Stack>

        {competition.summary ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {competition.summary}
          </Typography>
        ) : null}

        {/* Who is winning, said in words. The table below proves it, but the
            answer should not need reading a table first. */}
        <Stack direction="row" spacing={1.5} useFlexGap
          sx={{ flexWrap: "wrap", alignItems: "center" }}>
          {ran ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
              {ran.toUpperCase()}
            </Typography>
          ) : null}
          {leader ? (
            <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
              <MilitaryTechIcon sx={{ fontSize: 16, color: tokens.brass }} />
              <Typography variant="body2">
                <Box component="span" sx={{ color: tokens.inkMuted }}>
                  {competition.isCompleted ? "Won by " : "Leading: "}
                </Box>
                <Box component="span" sx={{ fontWeight: 700 }}>{leader.memberName}</Box>
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </Stack>
  );

  return (
    <Stack id={anchorId}
      sx={{ borderRadius: 2, overflow: "hidden", backgroundColor: tokens.paper,
            scrollMarginTop: { xs: 84, md: 96 },
            border: `1px solid ${competition.isCompleted ? tokens.rule : faction.base}` }}>
      {href ? (
        <NextLink href={href} style={{ textDecoration: "none", color: "inherit" }}>
          {head}
        </NextLink>
      ) : head}

      <Box sx={{ px: 2.5, py: 2 }}>
        <CompetitionStandings standings={competition.standings} faction={faction} />
      </Box>

      {/* The door, said in words and inside the card rather than as one grey
          strip under all of them. A link whose only affordance is hovering a
          heading does not exist on a phone, which is the rule this codebase
          already wrote down about the board's own controls. */}
      {href ? (
        <NextLink href={href} style={{ textDecoration: "none" }}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between",
                  px: 2.5, py: 1.5, borderTop: `1px solid ${tokens.rule}`,
                  backgroundColor: tokens.surface,
                  "&:hover": { backgroundColor: faction.soft } }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              Rounds and results
            </Typography>
            <ArrowForwardIcon sx={{ fontSize: 16, color: tokens.brand }} />
          </Stack>
        </NextLink>
      ) : null}

      {competition.updates.length ? (
        <Accordion disableGutters elevation={0} square
          sx={{ borderTop: `1px solid ${tokens.rule}`, "&::before": { display: "none" },
                backgroundColor: "transparent" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {`RESULTS HISTORY (${competition.updates.length})`}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2.5, pt: 0, pb: 2.5 }}>
            <Stack spacing={2}>
              {competition.updates.map((update) => (
                <Stack key={update.id} spacing={0.75}
                  sx={{ pl: 1.75, borderLeft: `2px solid ${faction.soft}` }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                    letterSpacing: "0.08em", color: tokens.inkMuted }}>
                    {(shortDate(update.postedOn) ?? "UPDATE").toUpperCase()}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontSize: "0.98rem" }}>
                    {update.title}
                  </Typography>
                  {update.summary ? (
                    <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                      {update.summary}
                    </Typography>
                  ) : null}
                  <CompetitionGames matches={update.matches}
                    faction={faction} played={played} />
                </Stack>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </Stack>
  );
}
