import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import CompetitionStandings from "./CompetitionStandings";
import { shortDate } from "@/utils/dates";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { Competition } from "@/types/competition";

/** One league, ladder or campaign. Legacy's showcase card (detail.js:5899). */
export default function CompetitionCard({
  competition, faction,
}: {
  competition: Competition;
  faction: Faction;
}) {
  const leader = competition.standings[0];
  const ran = [
    shortDate(competition.startDate),
    competition.endDate ? `${competition.isCompleted ? "ended" : "ends"} ${shortDate(competition.endDate)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Stack sx={{ borderRadius: 2, overflow: "hidden", backgroundColor: tokens.paper,
                 border: `1px solid ${competition.isCompleted ? tokens.rule : faction.base}` }}>
      <Stack spacing={1.25}
        sx={{ px: 2.5, py: 2.25,
              borderBottom: `1px solid ${tokens.rule}`,
              backgroundColor: competition.isCompleted ? tokens.surface : faction.soft }}>
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

      <Box sx={{ px: 2.5, py: 2 }}>
        <CompetitionStandings standings={competition.standings} faction={faction} />
      </Box>

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
                  {update.matches.map((match, i) => (
                    <Stack key={i} direction="row" spacing={1.25}
                      sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {match.playerOne}
                      </Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.84rem",
                                        color: faction.deep, fontWeight: 700 }}>
                        {match.playerOneScore} – {match.playerTwoScore}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {match.playerTwo}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </Stack>
  );
}
