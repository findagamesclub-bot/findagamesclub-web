import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InfoIcon from "@mui/icons-material/Info";
import CasinoIcon from "@mui/icons-material/Casino";
import EventSeatIcon from "@mui/icons-material/EventSeat";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import PushPinIcon from "@mui/icons-material/PushPin";
import SellIcon from "@mui/icons-material/Sell";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import Section from "@/components/ui/Section";
import ClubHeader from "@/components/clubs/ClubHeader";
import ClubGallery from "@/components/clubs/ClubGallery";
import ClubNights from "@/components/clubs/ClubNights";
import ClubNoticeboard from "@/components/clubs/ClubNoticeboard";
import ClubSidebar from "@/components/clubs/ClubSidebar";
import GameChips from "@/components/clubs/GameChips";
import { MembershipTiers, PricingList } from "@/components/clubs/ClubTiers";
import PreviewBar from "@/components/admin/PreviewBar";
import { getSubmissionForReview, getPreviewSlug } from "@/services/submissionReview.service";
import { previewClub } from "@/utils/preview-club";
import { clubIdentity } from "@/utils/club-identity";
import { publicUrl } from "@/lib/supabase/storage";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Preview a listing" };

/**
 * The listing as a club page, before anybody decides about it.
 *
 * The client's words: "a listing preview button on the submission review
 * screen, so an admin can see how the listing will look and make changes
 * before confirming or sending back."
 *
 * The review screen answers "is anything missing" and could not answer "what
 * will people see". Those are different questions and an admin was only ever
 * being asked the first one: 0160 put the photos on that screen and the rest
 * of the page was still a list of labels and values.
 *
 * Every component here is the club page's own, fed by `previewClub`, so what
 * an admin approves is what gets published. A preview drawn from its own
 * markup would be a preview of itself, and the first time either side changed
 * it would start quietly lying.
 *
 * Read-only, like the rest of this screen. An admin correcting somebody's
 * listing before approving it is an admin answering for a club they do not
 * run; sending it back with a note is slower and honest.
 */
export default async function PreviewSubmissionPage({
  params,
}: PageProps<"/admin/submissions/[id]/preview">) {
  const { id } = await params;

  const submission = await getSubmissionForReview(Number(id));
  if (!submission) notFound();

  const payload = (submission.payload ?? {}) as Record<string, unknown>;

  // The address the club will actually get, from the generator that will give
  // it to them. It matters for more than the URL on the bar: `clubIdentity`
  // hashes the slug, so a made-up one here would draw the whole page in a
  // different faction colour from the one it gets on the day.
  const slug = await getPreviewSlug(
    String((payload.club as Record<string, unknown> | undefined)?.name ?? submission.club_name ?? ""),
    String((payload.club as Record<string, unknown> | undefined)?.city ?? submission.city ?? ""),
  );

  const club = previewClub(payload, slug, publicUrl);
  const { faction } = clubIdentity(club.slug, club.name);

  const notices = club.announcements;

  return (
    <>
      <PreviewBar id={submission.id} slug={club.slug} name={club.name} />

      {/* The club page's own container and rhythm, so the widths and the
          spacing are the ones it will be published at rather than an
          approximation of them. */}
      <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
        <ClubHeader club={club} canBook={false} joinedCount={null} preview />

        <Box sx={{ display: "grid", gap: 4, mt: 4,
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          md: "minmax(0,2fr) minmax(280px,1fr)" } }}>
          <Stack spacing={0}
            sx={{ minWidth: 0, "& > section:first-of-type": { mt: { md: 0 } } }}>
            {notices.length ? (
              <Section title="Noticeboard" icon={PushPinIcon}
                note={`What ${club.name} wants members to know right now.`}>
                <ClubNoticeboard notices={notices} />
              </Section>
            ) : null}

            {club.description ? (
              <Section title="About" icon={InfoIcon}>
                <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
                  {club.description}
                </Typography>
              </Section>
            ) : null}

            {club.games.length ? (
              <Section title="What they play" icon={CasinoIcon}>
                <GameChips games={club.games} faction={faction} max={club.games.length} />
              </Section>
            ) : null}

            <Section title="Club nights" icon={EventSeatIcon}
              note="When the club meets, as members will read it.">
              <ClubNights
                schedule={club.schedule}
                tablesAvailable={club.tablesAvailable}
                slug={club.slug}
                clubName={club.name}
                faction={faction}
                canBook={false}
                signedIn={false}
                isMember={false}
                preview
              />
            </Section>

            {club.images.length > 1 ? (
              <Section title="Photos" icon={PhotoLibraryIcon}>
                <ClubGallery images={club.images} slug={club.slug} name={club.name} />
              </Section>
            ) : null}

            {club.pricingModels.length ? (
              <Section title="What it costs" icon={SellIcon}
                note="Turning up and playing, without joining.">
                <PricingList models={club.pricingModels} />
              </Section>
            ) : null}

            {club.membershipTiers.length ? (
              <Section title="Membership" icon={CardMembershipIcon}
                note="What joining gets somebody, and what it costs them.">
                <MembershipTiers tiers={club.membershipTiers} />
              </Section>
            ) : null}
          </Stack>

          <Box sx={{ minWidth: 0 }}>
            <ClubSidebar club={club} />
          </Box>
        </Box>

        {/* Said at the end rather than on the bar, where it would have made a
            one-line strip into a paragraph. A reviewer reaching the bottom and
            wondering where the reviews and the events are gets the answer in
            the place the question occurs to them. */}
        <Typography variant="body2"
          sx={{ mt: 5, pt: 2.5, borderTop: `1px solid ${tokens.rule}`,
                color: tokens.inkMuted }}>
          Reviews, events, the discussion board and the map are not here: this
          club has none of them yet, and the map is drawn from a postcode that
          is placed on the day the listing is approved. Everything above is
          what gets published.
        </Typography>
      </Container>
    </>
  );
}
