import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import MemberBanner from "./MemberBanner";
import Panel from "./Panel";
import { clubIdentity } from "@/utils/club-identity";
import LinkButton from "@/components/ui/LinkButton";
import type { MemberProfile } from "@/types/profile";
import type { MemberContext } from "@/services/memberContext.service";
import type { MemberRecords } from "@/services/memberRecords.service";
import type { ClubTracker } from "@/services/grudgeTracker.service";
import GrudgeTracker from "./GrudgeTracker";
import MemberPanels from "./MemberPanels";
import BackToTop from "@/components/ui/BackToTop";
import SportsScoreIcon from "@mui/icons-material/SportsScore";

/**
 * A member laid out as a datasheet rather than a column of sections.
 *
 * The first version stacked six full-width blocks, so four short lists took a
 * page and a half of scrolling. A datasheet is landscape and dense: banner,
 * their playing record, then two balanced columns of panels.
 */
export default function MemberProfileView({
  profile,
  isSelf = false,
  context,
  records,
  trackers,
}: {
  profile: MemberProfile;
  isSelf?: boolean;
  /** Shared clubs and the reader's record against them. */
  context?: MemberContext;
  /** League finishes, podiums and the badges they earn. */
  records?: MemberRecords;
  /** Their playing record at each club the reader shares with them. */
  trackers?: ClubTracker[];
}) {
  const { faction } = clubIdentity(profile.id, profile.fullName);

  const hasAnything =
    Boolean(profile.bio) ||
    profile.games.length > 0 ||
    profile.armies.length > 0 ||
    profile.availability.length > 0 ||
    profile.playStyle.length > 0 ||
    profile.socials.length > 0 ||
    Boolean(context?.clubs.length) ||
    Boolean(context?.meetings.length) ||
    Boolean(records?.competitions.length) ||
    Boolean(records?.podiums.length) ||
    Boolean(context?.events.length) ||
    Boolean(trackers?.length);

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

        {/* Second, not last. It is the answer to "how do they play", it is the
            tallest thing on the page, and buried under a column of short
            panels it took three screens of scrolling to reach. Full width
            because it carries tabs and two tables. */}
        {trackers?.length ? (
          <Panel title="Grudge tracker" icon={SportsScoreIcon}>
            <GrudgeTracker
              trackers={trackers}
              memberId={profile.id}
              firstName={profile.fullName.trim().split(" ")[0] || profile.fullName}
              isSelf={isSelf}
            />
          </Panel>
        ) : null}

        {hasAnything ? (
          <MemberPanels profile={profile} faction={faction} context={context}
            records={records} isSelf={isSelf} />
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

      <BackToTop />
    </Container>
  );
}
