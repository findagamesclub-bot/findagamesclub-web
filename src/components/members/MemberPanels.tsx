import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CasinoIcon from "@mui/icons-material/Casino";
import ShieldIcon from "@mui/icons-material/Shield";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import CakeIcon from "@mui/icons-material/Cake";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import PublicIcon from "@mui/icons-material/Public";
import Panel from "./Panel";
import WeekStrip from "./WeekStrip";
import MemberClubs from "./MemberClubs";
import MemberRecord from "./MemberRecord";
import MemberBadges from "./MemberBadges";
import MemberEvents from "./MemberEvents";
import { CompetitionRecords, Podiums } from "./MemberCompetitions";
import SocialLinks from "@/components/clubs/SocialLinks";
import GameChips from "@/components/clubs/GameChips";
import type { Faction } from "@/lib/tokens";
import type { MemberProfile } from "@/types/profile";
import type { MemberContext } from "@/services/memberContext.service";
import type { MemberRecords } from "@/services/memberRecords.service";

/**
 * Everything about a member that fits in a card, in two balanced columns.
 *
 * A grid of two fixed columns put every long panel on the right and left the
 * other empty for three screens, because how tall each side runs depends
 * entirely on what a member has filled in. Nothing hand-assigned stays
 * balanced across every profile, so the browser balances it.
 */
export default function MemberPanels({
  profile, faction, context, records, isSelf,
}: {
  profile: MemberProfile;
  faction: Faction;
  context?: MemberContext;
  records?: MemberRecords;
  isSelf: boolean;
}) {
  return (
    <Box
      sx={{
        columnCount: { xs: 1, md: 2 },
        columnGap: 2.5,
        // inline-block keeps a panel from being split down the middle.
        "& > section": {
          breakInside: "avoid",
          display: "inline-block",
          width: "100%",
          mb: 2.5,
        },
      }}
    >
      {profile.bio ? (
        <Panel title="About" icon={GroupsIcon}>
          <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>{profile.bio}</Typography>
        </Panel>
      ) : null}

      {profile.games.length ? (
        <Panel title="Games" icon={CasinoIcon}>
          <GameChips games={profile.games} faction={faction} max={profile.games.length} />
        </Panel>
      ) : null}

      {profile.armies.length ? (
        <Panel title="Armies and factions" icon={ShieldIcon}>
          <GameChips games={profile.armies} faction={faction} max={profile.armies.length} />
        </Panel>
      ) : null}
      {profile.availability.length ? (
        <Panel title="Usually free" icon={CalendarMonthIcon}>
          <WeekStrip available={profile.availability} id={profile.id} name={profile.fullName} />
        </Panel>
      ) : null}

      {profile.playStyle.length ? (
        <Panel title="Play style" icon={GroupsIcon}>
          <GameChips games={profile.playStyle} faction={faction} max={profile.playStyle.length} />
        </Panel>
      ) : null}

      {profile.ageGroups.length ? (
        <Panel title="Age group" icon={CakeIcon}>
          <GameChips games={profile.ageGroups} faction={faction} max={profile.ageGroups.length} />
        </Panel>
      ) : null}

      {/* Earned from standings rather than stored, so correcting a
          league table corrects the badges with it. */}
      {records?.badges.length ? (
        <Panel title="League and campaign badges" icon={EmojiEventsIcon}>
          <MemberBadges badges={records.badges} />
        </Panel>
      ) : null}

      {records?.competitions.length ? (
        <Panel title="League and campaign record" icon={MilitaryTechIcon}>
          <CompetitionRecords records={records.competitions} />
        </Panel>
      ) : null}

      {records?.podiums.length ? (
        <Panel title="Competition results" icon={EmojiEventsIcon}>
          <Podiums podiums={records.podiums} />
        </Panel>
      ) : null}

      {/* Where they play. Policy limits this to clubs the reader is
          also in, so it reads as "where we both play". */}
      {context?.clubs.length ? (
        <Panel title="Clubs" icon={GroupsOutlinedIcon}>
          <MemberClubs clubs={context.clubs} />
        </Panel>
      ) : null}

      {!isSelf && context?.meetings.length ? (
        <Panel title="You against them" icon={SportsEsportsIcon}>
          <MemberRecord
            name={profile.fullName.split(" ")[0] ?? profile.fullName}
            fullName={profile.fullName}
            record={context.record}
            meetings={context.meetings}
            clubs={context.clubs}
          />
        </Panel>
      ) : null}

      {context?.events.length ? (
        <Panel title="Event bookings and attendance" icon={ConfirmationNumberIcon}>
          <MemberEvents events={context.events} />
        </Panel>
      ) : null}

      {/* The same icon row the club pages use. A member's id stands in
          for a club's slug, so each person gets their own hover
          colour from the same function. */}
      {profile.socials.length ? (
        <Panel title="Find them elsewhere" icon={PublicIcon}>
          <SocialLinks links={profile.socials} slug={profile.id}
            name={profile.fullName} />
        </Panel>
      ) : null}    </Box>
  );
}
