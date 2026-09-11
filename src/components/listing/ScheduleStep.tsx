"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
import CampaignIcon from "@mui/icons-material/Campaign";
import Panel from "@/components/members/Panel";
import RemoveRow from "@/components/ui/RemoveRow";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { saveListingStepAction, type ListingState } from
  "@/app/clubs/[slug]/(console)/manage/listing/[step]/actions";
import { mono, tokens } from "@/lib/tokens";

export type NightRow = {
  id: string; day: string; time: string; label: string;
  /** Bookings still to come. A night carrying any cannot be removed. */
  booked: number;
};

/**
 * Step 4: when the club opens, and what it wants members to know.
 *
 * Each night says how many bookings hang off it, because the commonest thing
 * to do here is move a night and the commonest fear is losing them. Removing a
 * night with bookings is refused by the database; saying so on the row means
 * nobody finds that out by trying.
 */
export default function ScheduleStep({
  slug, nights: initialNights, notices: initialNotices,
}: {
  slug: string;
  nights: NightRow[];
  notices: string[];
}) {
  const [state, submit] = useActionState<ListingState, FormData>(saveListingStepAction, {});
  useActionToast(state);
  const [nights, setNights] = useState(initialNights);
  const [notices, setNotices] = useState(initialNotices);

  const set = (index: number, patch: Partial<NightRow>) =>
    setNights((held) => held.map((n, i) => (i === index ? { ...n, ...patch } : n)));

  return (
    <Box component="form" action={submit}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="step" value="schedule" />

      <Stack spacing={2.5}>
        <Panel title="Club nights" icon={CalendarIcon}>
          <Stack spacing={1.5}>
            {nights.length === 0 ? (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                No nights yet. Members cannot book a table until there is one.
              </Typography>
            ) : null}

            {nights.map((night, index) => (
              <Stack key={night.id || `new-${index}`} spacing={1}
                sx={{ p: 1.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                      backgroundColor: tokens.paper }}>
                <input type="hidden" name="nightId" value={night.id} />
                <Box sx={{ display: "grid", gap: 1.5, alignItems: "start",
                           gridTemplateColumns: {
                             xs: "minmax(0, 1fr)",
                             sm: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto" } }}>
                  <TextField size="small" label="Day" name="nightDay" value={night.day}
                    onChange={(e) => set(index, { day: e.target.value })} />
                  <TextField size="small" label="Time" name="nightTime" value={night.time}
                    onChange={(e) => set(index, { time: e.target.value })}
                    placeholder="18:30 to 22:00" />
                  <TextField size="small" label="What it is called" name="nightLabel"
                    value={night.label}
                    onChange={(e) => set(index, { label: e.target.value })} />
                  <RemoveRow what="night" disabled={night.booked > 0}
                    confirm={Boolean(night.id || night.day || night.time || night.label)}
                    body={<>
                      {night.label || night.day ? `"${night.label || night.day}"` : "This night"}
                      {" "}comes off your club page, and members cannot book a table on
                      it. Nothing changes until you save.
                    </>}
                    onRemove={() => setNights((held) => held.filter((_, i) => i !== index))} />
                </Box>

                {night.booked > 0 ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", color: tokens.brass }}>
                    {night.booked} BOOKING{night.booked === 1 ? "" : "S"} STILL TO COME.
                    EDITING THIS KEEPS THEM; REMOVING IT IS REFUSED.
                  </Typography>
                ) : null}
              </Stack>
            ))}

            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => setNights((held) =>
                [...held, { id: "", day: "", time: "", label: "", booked: 0 }])}>
              Add a night
            </Button>
          </Stack>
        </Panel>

        <Panel title="Noticeboard" icon={CampaignIcon}>
          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Short notices at the top of your club page. The first one is the one
              members see everywhere else.
            </Typography>

            {notices.map((notice, index) => (
              <Stack key={index} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <TextField size="small" fullWidth multiline name="notice" value={notice}
                  onChange={(e) => setNotices((held) =>
                    held.map((n, i) => (i === index ? e.target.value : n)))}
                  slotProps={{ htmlInput: { "aria-label": `Notice ${index + 1}` } }} />
                <RemoveRow what="notice" sx={{ alignSelf: "flex-start" }}
                  confirm={Boolean(notice.trim())}
                  body={<>
                    That notice comes off your noticeboard. Nothing changes until
                    you save.
                  </>}
                  onRemove={() => setNotices((held) => held.filter((_, i) => i !== index))} />
              </Stack>
            ))}

            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => setNotices((held) => [...held, ""])}>
              Add a notice
            </Button>
          </Stack>
        </Panel>
      </Stack>

      <Stack direction="row" spacing={2}
        sx={{ mt: 3, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Saving publishes straight away. Members see this on your club page.
        </Typography>
        <SubmitButton label="Save changes" pendingLabel="Saving" />
      </Stack>
    </Box>
  );
}
