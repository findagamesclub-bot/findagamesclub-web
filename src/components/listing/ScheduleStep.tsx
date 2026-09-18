"use client";

import { startTransition, useActionState, useState } from "react";
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
import StepTargetFields, { type StepTarget } from "./StepTarget";
import { useActionToast } from "@/components/ui/Toaster";
import { saveListingStepAction, type ListingState } from
  "@/app/clubs/[slug]/(console)/manage/listing/[step]/actions";
import { formatTimeRange, parseTimeRange } from "@/utils/time-range";
import { mono, tokens } from "@/lib/tokens";

export type NightRow = {
  id: string; day: string; time: string; label: string;
  /** Bookings still to come. A night carrying any cannot be removed. */
  booked: number;
};

/** A night while it is being edited: the two halves, plus how it arrived. */
type EditableNight = NightRow & {
  from: string;
  to: string;
  /** Its hours were never a clock time, so it keeps its own words. */
  words: boolean;
};

function asEditable(night: NightRow): EditableNight {
  const range = parseTimeRange(night.time);
  return range
    ? { ...night, from: range.from, to: range.to, words: false }
    : { ...night, from: "", to: "", words: Boolean(night.time.trim()) };
}

/**
 * Step 4: when the club opens, and what it wants members to know.
 *
 * Each night says how many bookings hang off it, because the commonest thing
 * to do here is move a night and the commonest fear is losing them. Removing a
 * night with bookings is refused by the database; saying so on the row means
 * nobody finds that out by trying.
 */
export default function ScheduleStep({
  target, nights: initialNights, notices: initialNotices,
}: {
  target: StepTarget;
  nights: NightRow[];
  notices: string[];
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
  /**
   * Each night holds its two halves, not just the joined string.
   *
   * Deriving them back out of `time` on every render looked tidy and was
   * wrong: picking a start before an end leaves "18:38", which is not a range,
   * so the row decided it was free text and swapped the pickers out from under
   * the person mid-edit. The halves are the state; the joined string is what
   * gets submitted.
   *
   * `words` is set once, on arrival, for a club whose hours were never a clock
   * time. It is never flipped by typing, only by clearing the box.
   */
  const [nights, setNights] = useState<EditableNight[]>(() =>
    initialNights.map(asEditable));
  const [notices, setNotices] = useState(initialNotices);

  const set = (index: number, patch: Partial<EditableNight>) =>
    setNights((held) => held.map((n, i) => (i === index ? { ...n, ...patch } : n)));

  return (
    <Box component="form" onSubmit={send}>
      <StepTargetFields target={target} step="schedule" />

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
                             sm: "minmax(0, 1fr) minmax(0, 1fr)",
                             md: "minmax(0, 1fr) 130px 130px minmax(0, 1fr) auto" } }}>
                  <TextField size="small" label="Day" name="nightDay" value={night.day}
                    onChange={(e) => set(index, { day: e.target.value })} />
                  {/* Two time inputs, not one box to type a range into. Same
                      control the event editor and the coaching slots already
                      use: a real picker on a phone, a keyboard on a desktop,
                      and always "18:30 - 22:30" rather than whatever the
                      person felt like that day.

                      The column still holds one string, so they are joined
                      back together into a hidden field and nothing below this
                      component changes.

                      A value that is not a range keeps its own box. A club
                      whose hours read "first Sunday, afternoon" has said
                      something true, and replacing that with 00:00 would be
                      the form deciding it knew better. */}
                  {night.words && night.time.trim() ? (
                    // Hours that were never a clock time keep their own box. A
                    // club whose Sunday reads "first Sunday, afternoon" has
                    // said something true, and replacing it with 00:00 would be
                    // the form deciding it knew better. Clearing it hands the
                    // row back to the pickers.
                    <TextField size="small" label="Time" name="nightTime"
                      value={night.time}
                      onChange={(e) =>
                        set(index, { time: e.target.value, words: Boolean(e.target.value.trim()) })}
                      helperText="Not a clock time. Clear it to pick hours." />
                  ) : (
                    <>
                      {/* The column holds one string, so the two halves are
                          joined back together here and nothing below this
                          component changes. */}
                      <input type="hidden" name="nightTime"
                        value={formatTimeRange(night.from, night.to)} />
                      <TextField size="small" label="Starts" type="time" value={night.from}
                        onChange={(e) => set(index, {
                          from: e.target.value,
                          time: formatTimeRange(e.target.value, night.to),
                        })} />
                      <TextField size="small" label="Ends" type="time" value={night.to}
                        onChange={(e) => set(index, {
                          to: e.target.value,
                          time: formatTimeRange(night.from, e.target.value),
                        })} />
                    </>
                  )}
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
                [...held, { id: "", day: "", time: "", label: "", booked: 0,
                            from: "", to: "", words: false }])}>
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
        <SubmitButton label="Save changes" pendingLabel="Saving" pending={saving} />
      </Stack>
    </Box>
  );
}
