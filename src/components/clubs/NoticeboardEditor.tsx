"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveRow from "@/components/ui/RemoveRow";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { saveNoticeboardAction, type NoticeboardState }
  from "@/app/clubs/[slug]/(console)/manage/noticeboard/actions";
import { MAX_NOTICES, MAX_NOTICE_LENGTH } from "@/utils/noticeboard";
import { shortDate, sinceLabel } from "@/utils/dates";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { Announcement } from "@/types/clubDetail";

/**
 * A row of the board while it is being edited.
 *
 * `message` is what it ARRIVED as, never what is in the box: the box is
 * uncontrolled and the form reads it by name. See the comment on the field.
 */
type Row = { key: string; id: number | null; message: string; createdAt: string };

const rowsFrom = (notices: Announcement[]): Row[] => notices.map((n) => ({
  key: `held-${n.id}`, id: n.id, message: n.message, createdAt: n.createdAt,
}));

/**
 * The club's noticeboard, edited as the board.
 *
 * Each row is drawn as the pinned note a member will read, with the date it
 * went up and the pin, and the box to type in sitting inside it. The same
 * argument the loyalty tone picker makes: an editor that hides what it is
 * editing is one a club never touches, and a notice is three lines of text
 * whose whole value is how it looks on the page it lands on.
 *
 * Newest first, matching the public board exactly, which is why Add a notice
 * puts the new one at the TOP. A notice added today is today's news and that
 * is where it will appear, so an editor that appended would disagree with the
 * page the moment it saved.
 */
export default function NoticeboardEditor({
  slug, notices, faction,
}: {
  slug: string;
  notices: Announcement[];
  faction: Faction;
}) {
  const [state, submit, saving] = useActionState<NoticeboardState, FormData>(
    saveNoticeboardAction, {});
  useActionToast(state);

  const [rows, setRows] = useState<Row[]>(() => rowsFrom(notices));

  /**
   * Re-seeded when the server's answer moves.
   *
   * A notice added here has `id: null` until it is saved, and the rows are
   * state rather than the prop, so without this a second press of Save would
   * post the same new notice with no id again and insert it twice. The keys
   * change with the ids, so the uncontrolled boxes remount on the server's
   * own text rather than keeping the draft.
   */
  useWhenChanged([notices], () => setRows(rowsFrom(notices)));

  /**
   * Dispatched by hand rather than through `action`.
   *
   * React 19 empties an uncontrolled form once its action has run, which is
   * right on a save that worked and catastrophic on one that was refused: the
   * club would be told to shorten a notice that was no longer on screen.
   */
  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };

  const room = MAX_NOTICES - rows.length;

  return (
    <Box component="form" onSubmit={send}>
      <input type="hidden" name="slug" value={slug} />

      <Stack direction="row" spacing={2} useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center", mb: 2.5 }}>
        <Button variant="outlined" startIcon={<AddIcon />} disabled={room <= 0}
          onClick={() => setRows((held) => [
            { key: `new-${Date.now()}`, id: null, message: "", createdAt: "" },
            ...held,
          ])}>
          Add a notice
        </Button>
        <Typography sx={{ fontFamily: display, fontSize: "0.75rem",
                          color: tokens.inkMuted, lineHeight: 1.6 }}>
          {room > 0
            ? `${room} more will fit. A new notice goes to the top.`
            : `A noticeboard holds ${MAX_NOTICES}. Take one down to add another.`}
        </Typography>
      </Stack>

      {rows.length === 0 ? (
        <Stack spacing={1} sx={{ border: `1px dashed ${tokens.rule}`, borderRadius: 2,
                                 p: { xs: 3, md: 5 }, textAlign: "center",
                                 bgcolor: tokens.paper, mb: 3 }}>
          <Typography variant="h4" sx={{ fontSize: "1.1rem" }}>
            Nothing on the board
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Car park closed, a change of hall, a game night moved. Short notices
            members see at the top of your club page.
          </Typography>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gap: 2, mb: 3,
                   gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
          {rows.map((row, index) => {
            const posted = row.createdAt ? shortDate(row.createdAt) : "";
            const ago = row.createdAt ? sinceLabel(row.createdAt) : "";

            return (
              <Stack key={row.key} spacing={1.25}
                sx={{ position: "relative", px: 2.25, pt: 2.5, pb: 2, borderRadius: 2,
                      backgroundColor: tokens.brassSoft,
                      border: "1px solid rgba(184,134,43,0.28)",
                      boxShadow: "0 6px 18px rgba(89,61,18,0.09)" }}>
                {/* The same pin the public board draws, so this reads as that
                    board rather than as a list of text boxes. */}
                <Box aria-hidden sx={{
                  position: "absolute", top: 10, right: 16,
                  width: 15, height: 15, borderRadius: "50%",
                  background: "radial-gradient(circle at 35% 35%, #ff9d87, #b73c24 72%)",
                  boxShadow: "0 3px 8px rgba(120,34,17,0.3)" }} />

                <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                                  letterSpacing: "0.08em", color: "rgba(92,67,16,0.8)", pr: 3 }}>
                  {posted
                    ? `${`ADDED ${posted}`.toUpperCase()}${ago ? ` · ${ago.toUpperCase()}` : ""}`
                    : "NOT UP YET"}
                </Typography>

                {/*
                  * On paper white inside the note, because a field that takes
                  * the note's own tint stops reading as something you type in.
                  *
                  * UNCONTROLLED, and that is load-bearing. A controlled MUI
                  * multiline field loses the keystroke that makes it grow a
                  * line: TextareaAutosize measures and sets its own state on
                  * input, and that re-render lands with the previous value
                  * still in `value`, so the character that caused the wrap is
                  * painted away. Measured by typing the alphabet four times
                  * over and counting: exactly one character gone at each wrap,
                  * in the same place every run. A club writing a three-line
                  * notice would lose a letter a line and never see it happen.
                  */}
                <TextField
                  name="notice" multiline minRows={2} fullWidth size="small"
                  defaultValue={row.message}
                  slotProps={{
                    htmlInput: { maxLength: MAX_NOTICE_LENGTH, "aria-label": `Notice ${index + 1}` },
                    input: { sx: { bgcolor: tokens.paper } },
                  }}
                />
                <input type="hidden" name="noticeId" value={row.id ?? ""} />

                <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                  {/* What the row arrived as, which is what the question is
                      about: taking down a notice that is already on the club's
                      page. A row added a moment ago has nothing to lose. */}
                  <RemoveRow what="notice" confirm={Boolean(row.message.trim())}
                    body={<>
                      That notice comes off your club page. Nothing changes until
                      you save.
                    </>}
                    onRemove={() => setRows((held) => held.filter((_, i) => i !== index))} />
                </Stack>
              </Stack>
            );
          })}
        </Box>
      )}

      <SubmitButton label="Save the noticeboard" pendingLabel="Saving the noticeboard"
        pending={saving}
        sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }} />
    </Box>
  );
}
