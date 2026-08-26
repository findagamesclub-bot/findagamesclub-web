import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CasinoIcon from "@mui/icons-material/Casino";
import ShieldIcon from "@mui/icons-material/Shield";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import CakeIcon from "@mui/icons-material/Cake";
import MemberBanner from "./MemberBanner";
import WeekStrip from "./WeekStrip";
import Panel from "./Panel";
import GameChips from "@/components/clubs/GameChips";
import { clubIdentity } from "@/utils/club-identity";
import LinkButton from "@/components/ui/LinkButton";
import type { MemberProfile } from "@/types/profile";

/**
 * A member laid out as a datasheet rather than a column of sections.
 *
 * The first version stacked six full-width blocks, so four short lists took a
 * page and a half of scrolling. A datasheet is landscape and dense: banner,
 * then two columns of panels. Everything a person needs to decide "would I
 * want a game with them, and when" now lands in one screen.
 */
export default function MemberProfileView({
  profile,
  isSelf = false,
}: {
  profile: MemberProfile;
  isSelf?: boolean;
}) {
  const { faction } = clubIdentity(profile.id, profile.fullName);

  const hasAnything =
    Boolean(profile.bio) ||
    profile.games.length > 0 ||
    profile.armies.length > 0 ||
    profile.availability.length > 0 ||
    profile.playStyle.length > 0;

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={2.5}>
        <MemberBanner profile={profile} action={
            isSelf ? (
              <LinkButton
                href="/account/profile"
                variant="outlined"
                sx={{
                  color: "#FFFFFF",
                  borderColor: "rgba(255,255,255,0.45)",
                  "&:hover": { borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.1)" },
                }}
              >
                Edit profile
              </LinkButton>
            ) : null
          } />

        {hasAnything ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 7fr) minmax(0, 5fr)" },
              gap: 2.5,
              alignItems: "start",
            }}
          >
            <Stack spacing={2.5}>
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
            </Stack>

            <Stack spacing={2.5}>
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
            </Stack>
          </Box>
        ) : (
          <Panel title="Nothing here yet" icon={GroupsIcon}>
            <Typography variant="body2" color="text.secondary">
              {isSelf
                ? "Add the games you play and the nights you are usually free, so other members can find you a game."
                : `${profile.fullName} has not filled in their profile yet.`}
            </Typography>
          </Panel>
        )}
      </Stack>
    </Container>
  );
}
