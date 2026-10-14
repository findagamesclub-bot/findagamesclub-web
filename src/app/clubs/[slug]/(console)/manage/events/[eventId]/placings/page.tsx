import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import BackLink from "@/components/ui/BackLink";
import LinkButton from "@/components/ui/LinkButton";
import EventPlacings from "@/components/events/EventPlacings";
import TeamPlacings from "./TeamPlacings";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import { getEventDetail } from "@/services/eventDetail.service";
import { getRoster } from "@/services/memberships.service";
import { getBuilderFor } from "@/services/armyBuilder.service";
import { getMemberLists } from "@/services/resultArmies.service";
import { clubIdentity } from "@/utils/club-identity";
import { eventRecordsArmies } from "@/utils/event-meta";
import { consoleBackTarget } from "@/utils/back-link";
import { tokens } from "@/lib/tokens";

export const metadata = { title: "Results and placings" };

/**
 * Who finished where.
 *
 * It used to be on the public event page, which is where the client found it
 * and asked the reasonable question: the draw, the rounds and the scores are
 * all in this console, and the one remaining job was done by leaving it and
 * visiting the page members read. Two places for one evening's work, and the
 * editing half sat on a page whose job is reading.
 *
 * So the whole of running an event is here now, and the public page is the
 * public page. It is the same `EventPlacings` either way, with `admin` set:
 * one component, two hosts, so the results a club types and the results a
 * member reads cannot drift apart.
 */
export default async function PlacingsPage({
  params, searchParams,
}: PageProps<"/clubs/[slug]/manage/events/[eventId]/placings">) {
  const { slug, eventId } = await params;
  const { from } = await searchParams;

  const [viewer, club] = await Promise.all([getCurrentProfile(), getClubDetail(slug)]);
  if (!viewer) {
    redirect(`/auth/sign-in?next=/clubs/${slug}/manage/events/${eventId}/placings`);
  }
  if (!club) notFound();

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) notFound();

  const event = await getEvent(club.id, Number(eventId));
  if (!event) notFound();

  // The placings themselves come from the reader's own service rather than a
  // second read, so what the club edits here is exactly what the public page
  // shows. `getEventDetail` needs the event's public key, not its row id.
  const [detail, members, builder, lists] = await Promise.all([
    getEventDetail(slug, event.legacyId, viewer),
    getRoster(club.id).catch(() => []),
    getBuilderFor(club.id).catch(() => null),
    getMemberLists(club.id).catch(() => []),
  ]);
  if (!detail) notFound();

  const roster = members
    .filter((m) => m.status === "approved")
    .map((m) => ({ id: m.profileId, name: m.fullName }));

  // Two short strings, not the catalogue: the dialog fetches that on its first
  // open. The event's own games gate it as well as the club's switch, so a
  // Blood Bowl weekend at a 40k club offers no army fields.
  const records = builder?.enabled && builder.editionId && builder.catalogueVersion
    && eventRecordsArmies(event.featuredGames)
    ? { editionId: builder.editionId, catalogueVersion: builder.catalogueVersion }
    : null;

  const { faction } = clubIdentity(club.slug, club.name);
  const back = consoleBackTarget(from, { slug, id: event.id, title: event.title });

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 3, md: 4 } }}>
      <BackLink href={back.href} label={back.label} />

      <PageHead
        title="Results and placings"
        lede={detail.teamEvent
          ? `Where each team finished at ${event.title}. A team event is placed by team, and the players in it come with it: first, second or third gives every one of them that badge.`
          : `Who finished where at ${event.title}. This is what the event's own page shows, so type it once and it is published.`}
      />

      <Stack spacing={2} sx={{ mt: 3 }}>
        {/* The unit a team event finishes in is the team, not the player, so
            this page asks the question the format asks. 0167 already awards
            the podium badge off the team's own rank. */}
        {detail.teamEvent ? (
          <>
            <TeamPlacings slug={slug} eventId={event.id}
              teams={detail.teams} faction={faction} />

            {/* An event switched to teams can still be carrying individual
                placings from before it was, and with the editor above asking
                only about teams there would be no way left to clear them.
                Shown only when there are some. */}
            {detail.placings.length ? (
              <Stack spacing={1.5} sx={{ pt: 2 }}>
                <Typography sx={{ fontSize: "0.75rem", lineHeight: 1.5,
                                  color: tokens.inkMuted }}>
                  This event also carries individual placings, from before it
                  ran as teams. They still show on the public page. Clear them
                  here if they are not meant to be there.
                </Typography>
                <EventPlacings
                  placings={detail.placings}
                  faction={faction}
                  viewerName={viewer.full_name ?? null}
                  admin={{
                    slug, eventKey: event.legacyId, eventId: event.id,
                    roster, builder: records, lists,
                  }}
                />
              </Stack>
            ) : null}
          </>
        ) : (
          <EventPlacings
            placings={detail.placings}
            faction={faction}
            viewerName={viewer.full_name ?? null}
            admin={{
              slug, eventKey: event.legacyId, eventId: event.id,
              roster, builder: records, lists,
            }}
          />
        )}

        <Typography sx={{ fontSize: "0.75rem", lineHeight: 1.5, color: tokens.inkMuted }}>
          {detail.teamEvent
            ? "Who is in each team is on the Teams page. The round by round scores are on the draw, and a table there records what each side brought."
            : "The round by round scores are on the draw, and a table there records what each side brought."}
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
          <LinkButton href={`/clubs/${slug}/manage/events/${event.id}/pairings`}
            variant="outlined" size="small">
            The draw
          </LinkButton>
          <LinkButton href={`/clubs/${slug}/events/${event.legacyId}`}
            variant="text" size="small">
            View the public page
          </LinkButton>
        </Stack>
      </Stack>
    </Container>
  );
}
