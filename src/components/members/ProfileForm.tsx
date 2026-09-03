"use client";

import { useActionState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChipListField from "./ChipListField";
import ToggleListField from "./ToggleListField";
import WeekPicker from "./WeekPicker";
import Panel from "./Panel";
import PublicIcon from "@mui/icons-material/Public";
import { SOCIAL_NETWORKS, socialValue } from "@/utils/social-links";
import SubmitButton from "@/components/ui/SubmitButton";
import { saveProfileAction, type ProfileFormState } from "@/app/account/profile/actions";
import PersonIcon from "@mui/icons-material/Person";
import CasinoIcon from "@mui/icons-material/Casino";
import PlaceIcon from "@mui/icons-material/Place";
import GroupsIcon from "@mui/icons-material/Groups";
import type { ProfileDraft } from "@/types/profile";

/** The fixed vocabularies. Duplicated from the service rather than imported,
 *  because that module is server-only. */
const AGE_GROUPS = ["Under 18", "18+", "Families welcome"] as const;
const PLAY_STYLES = [
  "Casual", "Competitive", "Narrative", "Painting and hobby", "Teaching newcomers",
] as const;

export default function ProfileForm({ draft }: { draft: ProfileDraft }) {
  const [state, formAction] = useActionState<ProfileFormState, FormData>(saveProfileAction, {});

  return (
    <form action={formAction}>
      <Stack spacing={2.5}>
        {state.error ? <Alert severity="error">{state.error}</Alert> : null}

        {/* Two columns so the whole form is visible at once. It was one stack of
            nine fields, which meant scrolling past the answers you had already
            given to reach the ones you had not. */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" },
            gap: 2.5,
            width: "100%",
            alignItems: "start",
          }}
        >
          <Stack spacing={2.5}>
            <Panel title="You" icon={PersonIcon}>
              <Stack spacing={2.5}>
                <TextField name="fullName" label="Your name" required defaultValue={draft.fullName} fullWidth />
                <TextField
                  name="bio" label="About you" multiline minRows={4} defaultValue={draft.bio} fullWidth
                  helperText="A line or two. What you play, how long you have been at it."
                />
              </Stack>
            </Panel>

            <Panel title="Where and when" icon={PlaceIcon}>
              <Stack spacing={2.5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    name="homePostcode" label="Home postcode" defaultValue={draft.homePostcode} fullWidth
                    helperText="Only the district is shown, so OX11 rather than your address."
                  />
                  <TextField
                    name="travelMiles" label="Will travel (miles)" type="number"
                    defaultValue={draft.travelMiles} fullWidth
                    slotProps={{ htmlInput: { min: 0, max: 500 } }}
                  />
                </Stack>
                <WeekPicker name="availability" value={draft.availability} />
              </Stack>
            </Panel>
          </Stack>

          <Stack spacing={2.5}>
            <Panel title="What you play" icon={CasinoIcon}>
              <Stack spacing={2.5}>
                <ChipListField
                  name="games" label="Games you play" value={draft.games}
                  placeholder="Warhammer 40,000" helperText="Press enter after each one."
                />
                <ChipListField
                  name="armies" label="Armies and factions" value={draft.armies}
                  placeholder="Death Guard" helperText="Press enter after each one."
                />
              </Stack>
            </Panel>

            <Panel title="How you play" icon={GroupsIcon}>
              <Stack spacing={2.5}>
                <ToggleListField name="playStyle" label="Play style" options={PLAY_STYLES} value={draft.playStyle} />
                <ToggleListField name="ageGroups" label="Age group" options={AGE_GROUPS} value={draft.ageGroups} />
              </Stack>
            </Panel>

            {/* Seven fields rather than a add-your-own list: these are the
                networks people actually name, and a fixed set means the
                profile can show the right icon for each. */}
            <Panel title="Find you elsewhere" icon={PublicIcon}>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Optional, and only shown to signed-in members. Paste the full
                  link to your page.
                </Typography>
                <Box sx={{ display: "grid", gap: 2,
                           gridTemplateColumns: {
                             xs: "minmax(0, 1fr)",
                             sm: "repeat(2, minmax(0, 1fr))",
                             lg: "repeat(3, minmax(0, 1fr))",
                           } }}>
                  {SOCIAL_NETWORKS.map((network) => (
                    <TextField
                      key={network}
                      name={`social-${network}`}
                      label={network}
                      type="url"
                      size="small"
                      defaultValue={socialValue(draft.socials, network)}
                      placeholder="https://..."
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  ))}
                </Box>
              </Stack>
            </Panel>
          </Stack>
        </Box>

        <Box>
          <SubmitButton label="Save profile" pendingLabel="Saving" size="large" />
        </Box>
      </Stack>
    </form>
  );
}
