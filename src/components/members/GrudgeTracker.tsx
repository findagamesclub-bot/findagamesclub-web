"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import LinkButton from "@/components/ui/LinkButton";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import GrudgeOverview from "./GrudgeOverview";
import GrudgeInsights from "./GrudgeInsights";
import RivalButton from "@/components/rivals/RivalButton";
import { clubIdentity } from "@/utils/club-identity";
import { display, mono, tokens } from "@/lib/tokens";
import type { ClubTracker } from "@/services/grudgeTracker.service";
import type { RivalMark } from "@/services/clubExtras.service";
import type { GameDetails } from "@/utils/game-details";

/**
 * How a member has done at each club they play at.
 *
 * Legacy calls this the grudge tracker and puts it on every member's profile;
 * ours had the same figures only on your own dashboard, so a reader looking at
 * somebody else saw none of it.
 *
 * One card per club rather than one merged record: a member who wins at one
 * club and loses at another has two records, and averaging them describes
 * neither.
 */
export default function GrudgeTracker({
  trackers, memberId, memberName, firstName, isSelf, rivalMarks, played,
}: {
  trackers: ClubTracker[];
  memberId: string;
  /** Whole name, for the rival button, which is about a person and not a card. */
  memberName: string;
  /** "Their" reads badly next to a name the reader already has in front of them. */
  firstName: string;
  isSelf: boolean;
  /**
   * Whether the reader has named them a rival, by club id. Absent on your own
   * profile, and absent entirely if that read failed, which costs the button
   * and not the card.
   */
  rivalMarks?: Map<number, RivalMark>;
  /**
   * What was played in their games, across every club on this page.
   *
   * One map rather than one per club: it is one read for the profile, and the
   * keys already carry the source and the id. Absent where the read failed,
   * which costs the control and not the record.
   */
  played?: GameDetails;
}) {
  return (
    <Stack spacing={2.5}>
      {trackers.map((tracker) => (
        <ClubCard key={tracker.club.id} tracker={tracker} memberId={memberId}
          memberName={memberName} firstName={firstName} isSelf={isSelf}
          mark={rivalMarks?.get(tracker.club.id) ?? null} played={played} />
      ))}
    </Stack>
  );
}

function ClubCard({ tracker, memberId, memberName, firstName, isSelf, mark, played }: {
  tracker: ClubTracker;
  memberId: string;
  memberName: string;
  firstName: string;
  isSelf: boolean;
  mark: RivalMark | null;
  played?: GameDetails;
}) {
  const [tab, setTab] = useState<"overview" | "insights">("overview");
  const { faction } = clubIdentity(tracker.club.slug, tracker.club.name);
  const { record } = tracker;

  return (
    <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
               backgroundColor: tokens.surface, overflow: "hidden" }}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <NextLink href={`/clubs/${tracker.club.slug}`} style={{ textDecoration: "none" }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: faction.deep,
                            "&:hover": { textDecoration: "underline" } }}>
            {tracker.club.name}
          </Typography>
        </NextLink>

        <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.25 }}>
          {record.winRate === null
            ? `${record.played} scored ${record.played === 1 ? "game" : "games"}`
            : `${record.played} games played · ${record.winRate}% win rate`}
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5 }}>
          <Pill label="Wins" value={record.won} tint={faction.soft} ink={faction.deep} />
          <Pill label="Draws" value={record.drawn} />
          <Pill label="Losses" value={record.lost} />
          <Pill label="Points" value={`${tracker.scoreFor} – ${tracker.scoreAgainst}`} />
        </Stack>

        <Tabs value={tab} onChange={(_, next: "overview" | "insights") => setTab(next)}
          sx={{ mt: 1.5, minHeight: 44,
                "& .MuiTabs-indicator": { backgroundColor: faction.base } }}>
          <Tab value="overview" label="Overview" sx={{ minHeight: 44 }} />
          <Tab value="insights" label="Insights" sx={{ minHeight: 44 }} />
        </Tabs>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: { xs: 2, sm: 2.5 }, pt: 0.5 }}>
        {tab === "overview"
          ? <GrudgeOverview tracker={tracker} faction={faction} memberId={memberId}
              memberName={memberName} played={played} />
          : <GrudgeInsights tracker={tracker} mineLabel={isSelf ? "You" : firstName} />}
      </Box>

      {/* Buttons, not text links. These were a mono caption the colour of a
          footnote and read as small print rather than as the two ways out of
          this card. */}
      <Stack spacing={1.5}
        sx={{ px: { xs: 2, sm: 2.5 }, py: 2,
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap
          sx={{ flexWrap: "wrap" }}>
        {/* Narrowed to this person. It said "<name>'s rivals" and landed on
            every pairing at the club, which is two questions wearing one
            button. `?member=` rather than component state, so the link can be
            sent to somebody, survives a refresh and the back button undoes it,
            which is the shape the badges list already uses. */}
        <LinkButton
          href={`/clubs/${tracker.club.slug}/rivalries?member=${memberId}`}
          variant="contained"
          startIcon={<MilitaryTechIcon />}
          sx={{ minHeight: 44, backgroundColor: faction.base, color: "#FFFFFF",
                "&:hover": { backgroundColor: faction.deep } }}
        >
          {isSelf ? "Your rivals" : `${firstName}'s rivals`}
        </LinkButton>

        <LinkButton
          href={`/clubs/${tracker.club.slug}`}
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          sx={{ minHeight: 44, color: faction.deep, borderColor: faction.base,
                "&:hover": { borderColor: faction.deep, backgroundColor: faction.soft } }}
        >
          Open club
        </LinkButton>
        </Stack>

        {/* Naming a rival lived only on the club's roster page, so it meant
            finding somebody in a list in order to say a thing about the person
            already on the screen in front of you. Here because the card is
            already scoped to one club, which is exactly what a rival row
            needs: you can be somebody's rival at Didcot and not at the club
            you both play at on Saturdays.

            Its own row, under the two links rather than beside them. Those go
            somewhere and this changes something, and a toggle reading "Rivals"
            shoulder to shoulder with a link reading "Joe's rivals" is two
            different kinds of control wearing one shape and nearly one set of
            words.

            The state is in words next to it rather than only in the hover text
            the button used to carry, because a tooltip is not a way to tell
            somebody something on a phone. */}
        {!isSelf && mark ? (
          <Stack direction="row" spacing={1.5} useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <RivalButton
              clubId={tracker.club.id}
              slug={tracker.club.slug}
              personId={memberId}
              personName={memberName}
              rivalRowId={mark.rowId}
              mutual={mark.mutual}
              faction={faction}
              size="medium"
              tooltip={false}
            />
            <Typography sx={{ fontFamily: display, fontSize: "0.75rem",
                              lineHeight: 1.6, color: tokens.inkMuted }}>
              {mark.rowId
                ? (mark.mutual
                    ? `You and ${firstName} have named each other.`
                    : `You count ${firstName} as a rival. ${firstName} has not said the same.`)
                : `Count ${firstName} as a rival and they lead your own list.`}
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

function Pill({ label, value, tint, ink }: {
  label: string; value: number | string; tint?: string; ink?: string;
}) {
  return (
    <Stack direction="row" spacing={0.75}
      sx={{ alignItems: "baseline", px: 1.25, py: 0.5, borderRadius: 999,
            border: `1px solid ${tokens.rule}`, backgroundColor: tint ?? tokens.paper }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.08em",
                        color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
      <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", fontWeight: 700,
                        fontVariantNumeric: "tabular-nums", color: ink ?? tokens.ink }}>
        {value}
      </Typography>
    </Stack>
  );
}
