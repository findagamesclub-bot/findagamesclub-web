"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import BadgeIcon from "@mui/icons-material/AssignmentInd";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PlaceIcon from "@mui/icons-material/Place";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import Section from "@/components/ui/Section";
import Panel from "@/components/members/Panel";
import ChipListField from "@/components/members/ChipListField";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import EventArtwork from "./EventArtwork";
import { saveEventAction, type EventEditState } from "./actions";
import type { EditableEvent } from "@/types/eventEditor";

/**
 * Everything about an event except what it sells and what it has posted.
 *
 * One form and one Save, because these are the fields somebody fills in while
 * they have the flyer in front of them. Tickets and notices are their own
 * saves: adding a ticket type on a Tuesday should not need the date typed
 * again.
 */
export default function EventDetailsForm({
  slug, event, club,
}: {
  slug: string;
  event: EditableEvent;
  club: { venueName: string; venueAddress: string; venuePostcode: string; clubId: number };
}) {
  const [state, submit] = useActionState<EventEditState, FormData>(saveEventAction, {});
  useActionToast(state);
  const error = (field: string) => state.errors?.[field];

  // An event at the club's own hall is the common case, and three fields
  // copied by hand is three chances to mistype the postcode that places the
  // pin on the map.
  const sameAsClub = !event.venueName && !event.venuePostcode;
  const [atClub, setAtClub] = useState(sameAsClub);
  const [venue, setVenue] = useState({
    name: event.venueName, address: event.venueAddress, postcode: event.venuePostcode,
  });

  const useClubVenue = (on: boolean) => {
    setAtClub(on);
    if (on) {
      setVenue({ name: club.venueName, address: club.venueAddress,
                 postcode: club.venuePostcode });
    }
  };

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="eventId" value={event.id} />

      <Section title="Details" icon={BadgeIcon} navLabel="Details">
        <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          md: "repeat(2, minmax(0, 1fr))" } }}>
          <Panel title="What it is">
            <Stack spacing={2}>
              <TextField name="title" label="Name" defaultValue={event.title} required fullWidth
                error={Boolean(error("title"))} helperText={error("title")} />
              <TextField name="summary" label="Summary" defaultValue={event.summary}
                fullWidth multiline minRows={3}
                helperText="What it is, in a couple of lines. This is what the event card shows." />
              <TextField name="price" label="Price" defaultValue={event.price} fullWidth
                helperText='Free text, like "GBP 20" or "Pay what you can". Ticket types carry their own prices.' />
              <TextField name="roundCount" label="Rounds" type="number"
                defaultValue={event.roundCount ?? ""} fullWidth
                slotProps={{ htmlInput: { min: 0, max: 50 } }}
                error={Boolean(error("roundCount"))}
                helperText={error("roundCount")
                  ?? "Tournaments only. It caps which rounds the draw will accept."} />
              <TextField name="bestcoastLink" label="Best Coast Pairings link"
                defaultValue={event.bestcoastLink} fullWidth
                error={Boolean(error("bestcoastLink"))}
                helperText={error("bestcoastLink")
                  ?? "Optional. Shown on the event page for anybody following along."} />
            </Stack>
          </Panel>

          <Stack spacing={2.5}>
            <Panel title="When" icon={ScheduleIcon}>
              <Stack spacing={2}>
                <Box sx={{ display: "grid", gap: 2,
                           gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <TextField name="startDate" label="First day" type="date" required
                    defaultValue={event.startDate}
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={Boolean(error("startDate"))} helperText={error("startDate")} />
                  <TextField name="startTime" label="Starts" type="time"
                    defaultValue={event.startTime}
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={Boolean(error("startTime"))} helperText={error("startTime")} />
                  <TextField name="endDate" label="Last day" type="date"
                    defaultValue={event.endDate}
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={Boolean(error("endDate"))}
                    helperText={error("endDate") ?? "Only for an event over more than one day."} />
                  <TextField name="endTime" label="Finishes" type="time"
                    defaultValue={event.endTime}
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={Boolean(error("endTime"))} helperText={error("endTime")} />
                </Box>
              </Stack>
            </Panel>

            <Panel title="Where" icon={PlaceIcon}>
              <Stack spacing={2}>
                <FormControlLabel
                  control={<Switch checked={atClub}
                    onChange={(e) => useClubVenue(e.target.checked)} />}
                  label="At the club's usual venue"
                />
                <TextField name="venueName" label="Venue name" fullWidth disabled={atClub}
                  value={venue.name}
                  onChange={(e) => setVenue({ ...venue, name: e.target.value })} />
                <TextField name="venueAddress" label="Address" fullWidth multiline minRows={2}
                  disabled={atClub} value={venue.address}
                  onChange={(e) => setVenue({ ...venue, address: e.target.value })} />
                <TextField name="venuePostcode" label="Postcode" fullWidth disabled={atClub}
                  value={venue.postcode}
                  onChange={(e) => setVenue({ ...venue, postcode: e.target.value })}
                  helperText="This places the event on the map, so it is worth filling in." />
              </Stack>
            </Panel>
          </Stack>
        </Box>
      </Section>

      <Section title="What you play" icon={LocalOfferIcon} navLabel="What you play">
        <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          md: "repeat(2, minmax(0, 1fr))" } }}>
          <Panel title="Games and formats">
            <Stack spacing={2}>
              <ChipListField name="featuredGames" label="Games" value={event.featuredGames}
                placeholder="Add a game and press Enter"
                helperText="Warhammer 40,000, Blood Bowl, whatever is being played." />
              <ChipListField name="formats" label="Formats" value={event.formats}
                placeholder="Add a format and press Enter"
                helperText="Competitive, narrative, casual." />
            </Stack>
          </Panel>

          <Panel title="Kind of day and what is there">
            <Stack spacing={2}>
              <ChipListField name="eventTypes" label="Event types" value={event.eventTypes}
                placeholder="Add a type and press Enter"
                helperText="Tournament, open day, campaign day, painting session." />
              <ChipListField name="facilities" label="Facilities" value={event.facilities}
                placeholder="Add a facility and press Enter"
                helperText="Parking, food on site, step-free access." />
            </Stack>
          </Panel>
        </Box>
      </Section>

      <Section title="Artwork and the info board" navLabel="Artwork">
        <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          md: "repeat(2, minmax(0, 1fr))" } }}>
          <EventArtwork clubId={club.clubId} event={event} />

          <Panel title="Info board">
            <TextField name="infoBoard" label="Only ticket holders see this"
              defaultValue={event.infoBoard} fullWidth multiline minRows={8}
              helperText="Directions, parking, what to bring, the schedule for the day. It appears on the event page once somebody holds a ticket." />
          </Panel>
        </Box>
      </Section>

      <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 3 }}>
        <SubmitButton label="Save changes" pendingLabel="Saving the event" />
      </Stack>
    </Box>
  );
}
