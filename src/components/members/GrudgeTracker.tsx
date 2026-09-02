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
import { clubIdentity } from "@/utils/club-identity";
import { mono, tokens } from "@/lib/tokens";
import type { ClubTracker } from "@/services/grudgeTracker.service";

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
  trackers, memberId, firstName, isSelf,
}: {
  trackers: ClubTracker[];
  memberId: string;
  /** "Their" reads badly next to a name the reader already has in front of them. */
  firstName: string;
  isSelf: boolean;
}) {
  return (
    <Stack spacing={2.5}>
      {trackers.map((tracker) => (
        <ClubCard key={tracker.club.id} tracker={tracker} memberId={memberId}
          firstName={firstName} isSelf={isSelf} />
      ))}
    </Stack>
  );
}

function ClubCard({ tracker, memberId, firstName, isSelf }: {
  tracker: ClubTracker;
  memberId: string;
  firstName: string;
  isSelf: boolean;
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
          ? <GrudgeOverview tracker={tracker} faction={faction} memberId={memberId} />
          : <GrudgeInsights tracker={tracker} mineLabel={isSelf ? "You" : firstName} />}
      </Box>

      {/* Buttons, not text links. These were a mono caption the colour of a
          footnote and read as small print rather than as the two ways out of
          this card. */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap
        sx={{ flexWrap: "wrap", px: { xs: 2, sm: 2.5 }, py: 2,
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        <LinkButton
          href={`/clubs/${tracker.club.slug}/rivalries`}
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
