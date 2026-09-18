"use client";

import { startTransition, useActionState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BadgeIcon from "@mui/icons-material/AssignmentInd";
import PlaceIcon from "@mui/icons-material/Place";
import MailIcon from "@mui/icons-material/AlternateEmail";
import GroupsIcon from "@mui/icons-material/Groups";
import Panel from "@/components/members/Panel";
import ChipListField from "@/components/members/ChipListField";
import SubmitButton from "@/components/ui/SubmitButton";
import StepTargetFields, { type StepTarget } from "./StepTarget";
import { useActionToast } from "@/components/ui/Toaster";
import { saveListingStepAction, type ListingState } from
  "@/app/clubs/[slug]/(console)/manage/listing/[step]/actions";
import { tokens } from "@/lib/tokens";

export type ProfileValues = {
  name: string; city: string; neighbourhood: string;
  summary: string; description: string; formats: string[];
  venueName: string; venueAddress: string; postcode: string; website: string;
  contactEmail: string; ages: string[];
  memberCount: string; tablesAvailable: string;
};

/**
 * Step 1: who the club is, where it meets, how to reach it, and how many fit.
 *
 * Thirteen fields, which is legacy's own count for this step. Grouped as
 * legacy's readiness checks group them, so the four blocks here are the four
 * lines on the review page and somebody fixing "Venue: 3 of 4" knows which box
 * to open.
 */
export default function ProfileStep({
  target, values,
}: {
  target: StepTarget;
  values: ProfileValues;
}) {
  const [state, submit, saving] = useActionState<ListingState, FormData>(saveListingStepAction, {});
  useActionToast(state);

  /**
   * Submitted by hand rather than through the form's `action` prop.
   *
   * React 19 resets an uncontrolled form once its action has run. That is right
   * when the save worked and catastrophic when it did not: a refused save
   * emptied all thirteen fields and then said "some of that needs another look"
   * about work that was no longer on screen. Dispatching the action ourselves
   * keeps everything typed exactly where it was.
   *
   * The button is told it is busy for the same reason: `useFormStatus` only
   * reports on a form that submits through `action`.
   */
  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };
  const error = (field: string) => state.errors?.[field];

  return (
    <Box component="form" onSubmit={send}>
      <StepTargetFields target={target} step="profile" />

      <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
        <Panel title="The club" icon={BadgeIcon}>
          <Stack spacing={2}>
            <TextField name="name" label="Club name" defaultValue={values.name} required
              fullWidth error={Boolean(error("name"))} helperText={error("name")} />
            <TextField name="city" label="Town or city" defaultValue={values.city} fullWidth
              error={Boolean(error("city"))} helperText={error("city")} />
            <TextField name="neighbourhood" label="Neighbourhood" fullWidth
              defaultValue={values.neighbourhood}
              helperText="Optional. The part of town people would say they are going to." />
            <TextField name="summary" label="Summary" defaultValue={values.summary} fullWidth
              multiline minRows={2}
              error={Boolean(error("summary"))}
              helperText={error("summary") ?? "One line. This is what the directory card shows."} />
            <TextField name="description" label="Description" defaultValue={values.description}
              fullWidth multiline minRows={4}
              error={Boolean(error("description"))}
              helperText={error("description") ?? "The longer version, on your club page."} />
            <ChipListField name="formats" label="What kind of club is it"
              error={Boolean(error("formats"))}
              value={values.formats}
              placeholder="Add a format and press Enter"
              helperText={error("formats") ?? "Wargaming, board games, role-playing, and so on."} />
          </Stack>
        </Panel>

        <Stack spacing={2.5}>
          <Panel title="Where you meet" icon={PlaceIcon}>
            <Stack spacing={2}>
              <TextField name="venueName" label="Venue name" defaultValue={values.venueName}
                fullWidth />
              <TextField name="venueAddress" label="Address" defaultValue={values.venueAddress}
                fullWidth multiline minRows={2} />
              <TextField name="postcode" label="Postcode" defaultValue={values.postcode} fullWidth
                error={Boolean(error("postcode"))}
                helperText={error("postcode")
                  ?? "This places you on the map. Changing it moves your pin."} />
            </Stack>
          </Panel>

          <Panel title="How people reach you" icon={MailIcon}>
            <Stack spacing={2}>
              <TextField name="contactEmail" label="Public contact email" type="email"
                defaultValue={values.contactEmail} fullWidth
                error={Boolean(error("contactEmail"))}
                helperText={error("contactEmail") ?? "Shown on your club page."} />
              <TextField name="website" label="Website" defaultValue={values.website} fullWidth
                error={Boolean(error("website"))}
                helperText={error("website") ?? "Optional. Start with https://"} />
            </Stack>
          </Panel>

          <Panel title="Who you can take" icon={GroupsIcon}>
            <Stack spacing={2}>
              <ChipListField name="ages" label="Age groups" value={values.ages}
                error={Boolean(error("ages"))}
                placeholder="Add an age group and press Enter"
                helperText={error("ages") ?? "All ages, under 18, adults only, and so on."} />
              <TextField name="memberCount" label="Members" defaultValue={values.memberCount}
                fullWidth inputMode="numeric"
                error={Boolean(error("memberCount"))}
                helperText={error("memberCount")
                  ?? "Your own figure, not the number of accounts here."} />
              <TextField name="tablesAvailable" label="Tables a night"
                defaultValue={values.tablesAvailable} fullWidth inputMode="numeric"
                error={Boolean(error("tablesAvailable"))}
                helperText={error("tablesAvailable")
                  ?? "How many games can run at once. Leave blank if you do not book tables."} />
            </Stack>
          </Panel>
        </Stack>
      </Box>

      <Stack direction="row" spacing={2}
        sx={{ mt: 3, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Saving publishes straight away. Members see this on your club page.
        </Typography>
        <SubmitButton label="Save changes" pendingLabel="Saving" pending={saving} />
      </Stack>
    </Box>
  );
}
