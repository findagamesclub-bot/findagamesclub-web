import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import GroupsIcon from "@mui/icons-material/Groups";
import ForumIcon from "@mui/icons-material/Forum";
import Section from "@/components/ui/Section";
import EventRoster from "./EventRoster";
import { tokens, type Faction } from "@/lib/tokens";
import type { RosterEntry, BoardPost } from "@/services/eventBoard.service";

/**
 * What a ticket unlocks: who else is going, and what they are saying.
 *
 * Both together because they answer the same question and share the same gate.
 * The board is summarised here and lives on its own page, the way legacy does
 * it: three titles is enough to know whether it is worth opening.
 */
export default function EventCommunity({
  roster, threads, faction, viewerId, canManage, slug, eventId, trail, hasAttendees,
}: {
  roster: RosterEntry[];
  threads: BoardPost[];
  faction: Faction;
  viewerId: string | null;
  canManage: boolean;
  slug: string;
  eventId: string;
  /** Carries the search you arrived from through to the door list. */
  trail: string;
  hasAttendees: boolean;
}) {
  const board = `/clubs/${slug}/events/${eventId}/board`;

  return (
    <>
      {/* Names and ticket counts. The email, the reference and the money stay
          on the club's own door list, which is what the link opens. */}
      <Section title="Who is coming" icon={GroupsIcon} navLabel="Roster"
        action={
          canManage && hasAttendees ? (
            <NextLink href={`/clubs/${slug}/events/${eventId}/attendees${trail}`}
              style={{ textDecoration: "none" }}>
              <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                Open the door list
              </Typography>
            </NextLink>
          ) : undefined
        }>
        <EventRoster roster={roster} faction={faction} viewerId={viewerId} />
      </Section>

      <Section title="Event board" icon={ForumIcon} navLabel="Board"
        note="Questions and notices between everybody going to this event."
        action={
          <NextLink href={board} style={{ textDecoration: "none" }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              {threads.length ? `Open the board (${threads.length})` : "Open the board"}
            </Typography>
          </NextLink>
        }>
        {threads.length ? (
          <Stack spacing={0.75}>
            {threads.slice(0, 3).map((t) => (
              <NextLink key={t.id} href={board} style={{ textDecoration: "none" }}>
                <Typography variant="body2"
                  sx={{ color: tokens.ink, "&:hover": { color: faction.base } }}>
                  {t.title}
                  <Box component="span" sx={{ color: tokens.inkMuted, ml: 1 }}>
                    {t.replies.length
                      ? `${t.replies.length} ${t.replies.length === 1 ? "reply" : "replies"}`
                      : "no replies yet"}
                  </Box>
                </Typography>
              </NextLink>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Nothing on the board yet. Ask the organisers a question, or tell the
            other players something they need to know before the day.
          </Typography>
        )}
      </Section>
    </>
  );
}
