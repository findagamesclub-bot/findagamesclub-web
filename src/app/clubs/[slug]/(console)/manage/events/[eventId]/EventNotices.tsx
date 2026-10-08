"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CampaignIcon from "@mui/icons-material/Campaign";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import NoticeDialog from "./NoticeDialog";
import Section from "@/components/ui/Section";
import RemoveRow from "@/components/ui/RemoveRow";
import BusyOverlay from "@/components/ui/BusyOverlay";
import { useActionToast } from "@/components/ui/Toaster";
import { noticeAction, type EventEditState } from "./actions";
import { sinceLabel } from "@/utils/dates";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { useKeepScroll } from "@/hooks/useKeepScroll";
import { tokens } from "@/lib/tokens";
import type { EditableEvent, EventNotice } from "@/types/eventEditor";

/**
 * Short updates, newest first.
 *
 * Separate from the info board because they are different jobs: the board is
 * the standing information, a notice is "the hall has changed, use the side
 * door". Posted one at a time so a correction on the day is one box and one
 * button rather than a whole form.
 *
 * A notice can be corrected as well as taken down, which the client asked for.
 * The write has been granted since 0090 and nothing reached it, so the club's
 * only way to fix a typo was to delete the notice and post it again, which
 * moves it to the top of a list ordered by when things were said.
 */
export default function EventNotices({
  slug, event,
}: {
  slug: string;
  event: EditableEvent;
}) {
  const [state, submit, busy] = useActionState<EventEditState, FormData>(noticeAction, {});
  // See useKeepScroll: saving refreshes the route and takes the scroll with it.
  const keep = useKeepScroll(state);
  useActionToast(state);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<EventNotice | null>(null);

  // Cleared once a post lands, so the box is empty for the next one. Through
  // the shared hook rather than a hand-rolled latch: a render-time check would
  // also wipe a notice somebody started typing while the last one was still
  // saving, which is why this cannot be done during render like the dialogs.
  useActionSuccess(state, () => { setMessage(""); setEditing(null); });

  const send = (noticeId: number, fields: Record<string, string> = {}) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("eventId", String(event.id));
    data.set("noticeId", String(noticeId));
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    startTransition(() => submit(data));
  };

  return (
    <Section title="Notices" icon={CampaignIcon} navLabel="Notices"
      note="Everybody holding a ticket sees these on the event page.">
      <Stack spacing={2}>
        <Box component="form" action={(data) => keep(() => submit(data))}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="eventId" value={event.id} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
            sx={{ alignItems: { sm: "flex-start" } }}>
            <TextField name="message" label="Post a notice" fullWidth multiline minRows={2}
              value={message} onChange={(e) => setMessage(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              helperText="Short and specific. A change of hall, a late start, a reminder to bring a list." />
            <Button type="submit" variant="contained" disabled={!message.trim()}
              loading={busy} loadingPosition="start"
              aria-label={busy ? "Posting the notice" : undefined}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, mt: { sm: 1 } }}>
              Post
            </Button>
          </Stack>
        </Box>

        <BusyOverlay busy={busy} variant="dim" label="Saving">
          <Stack spacing={1}>
            {event.notices.length === 0 ? (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Nothing posted yet.
              </Typography>
            ) : null}

            {event.notices.map((notice) => (
              <Box key={notice.id}
                sx={{ display: "grid", gap: 1.5, alignItems: "start", p: 1.75,
                      borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                      backgroundColor: tokens.paper,
                      gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {notice.message}
                  </Typography>
                  <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
                    {sinceLabel(notice.createdAt)}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignSelf: "start" }}>
                  <IconButton size="small" aria-label="Edit notice" disabled={busy}
                    onClick={() => setEditing(notice)}
                    sx={{ color: tokens.inkMuted,
                          "&:hover": { color: tokens.brand } }}>
                    <EditOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                  <RemoveRow what="notice"
                    body="It comes off the event page straight away."
                    onRemove={() => send(notice.id)} />
                </Stack>
              </Box>
            ))}
          </Stack>
        </BusyOverlay>
      </Stack>

      <NoticeDialog notice={editing} saving={busy}
        onClose={() => setEditing(null)}
        onSave={(next) => editing && send(editing.id, { intent: "edit", message: next })} />
    </Section>
  );
}
