"use client";

import { useActionState, useState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import LockIcon from "@mui/icons-material/Lock";
import PollIcon from "@mui/icons-material/Poll";
import PhotoPicker from "./PhotoPicker";
import { usePostPhotos } from "@/hooks/usePostPhotos";
import { boardAction, type BoardState } from "@/app/clubs/[slug]/board/actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { CategoryOption } from "@/utils/discussion-categories";

/** Start a thread, optionally with a poll attached. */
export default function NewPostForm({
  clubId, slug, faction, categories, profileId,
}: {
  clubId: number;
  slug: string;
  faction: Faction;
  categories: CategoryOption[];
  /** Whose folder the photos upload into. */
  profileId: string;
}) {
  const [state, submit, busy] = useActionState<BoardState, FormData>(boardAction, {});
  useActionToast(state);
  const [open, setOpen] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const photos = usePostPhotos(profileId);
  const fullScreen = useMediaQuery("(max-width:600px)");

  const open_ = categories.filter((c) => !c.lockedBy);

  return (
    <>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}
        disabled={open_.length === 0}
        sx={{ backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
        Start a thread
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle sx={{ pr: 6 }}>
          Start a thread
          <IconButton onClick={() => setOpen(false)} aria-label="Close"
            sx={{ position: "absolute", right: 12, top: 12 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Box component="form" action={submit} sx={{ pt: 0.5 }}>
            <input type="hidden" name="intent" value="post" />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="clubId" value={clubId} />

            <Stack spacing={2.25}>

              <TextField name="category" select label="Category" required fullWidth
                defaultValue={open_[0]?.label ?? ""}>
                {categories.map((c) => (
                  <MenuItem key={c.label} value={c.label} disabled={Boolean(c.lockedBy)}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      {c.lockedBy ? <LockIcon sx={{ fontSize: 15, color: tokens.inkMuted }} /> : null}
                      <span>{c.label}</span>
                      {c.lockedBy ? (
                        <Typography component="span" variant="caption" sx={{ color: tokens.inkMuted }}>
                          {c.lockedBy} only
                        </Typography>
                      ) : null}
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>

              <TextField name="title" label="Title" required fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }} />

              <TextField name="content" label="What do you want to say?" required fullWidth
                multiline minRows={4} slotProps={{ htmlInput: { maxLength: 8000 } }} />

              <PhotoPicker {...photos} />

              {showPoll ? (
                <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5, p: 2 }}>
                  <Stack spacing={1.75}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700,
                                        fontSize: "0.95rem" }}>
                        Poll
                      </Typography>
                      <Button size="small" variant="text"
                        onClick={() => { setShowPoll(false); setOptions(["", ""]); }}
                        sx={{ color: tokens.inkMuted }}>
                        Remove
                      </Button>
                    </Stack>

                    <TextField name="pollQuestion" label="Question" fullWidth size="small"
                      slotProps={{ htmlInput: { maxLength: 200 } }} />

                    {options.map((value, i) => (
                      <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <TextField
                          name="pollOption" label={`Answer ${i + 1}`} fullWidth size="small"
                          value={value}
                          onChange={(e) => setOptions((prev) =>
                            prev.map((v, j) => (j === i ? e.target.value : v)))}
                          slotProps={{ htmlInput: { maxLength: 120 } }}
                        />
                        {options.length > 2 ? (
                          <IconButton size="small" aria-label={`Remove answer ${i + 1}`}
                            onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}>
                            <CloseIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        ) : null}
                      </Stack>
                    ))}

                    {options.length < 8 ? (
                      <Button size="small" startIcon={<AddIcon />} variant="text"
                        onClick={() => setOptions((prev) => [...prev, ""])}>
                        Add another answer
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              ) : (
                <Button variant="outlined" startIcon={<PollIcon />} onClick={() => setShowPoll(true)}
                  sx={{ alignSelf: "flex-start" }}>
                  Add a poll
                </Button>
              )}

              {/* Held back while a photo is still going up: its hidden field
                  only exists once the upload lands, so posting now would drop
                  the picture without saying so. */}
              <Button type="submit" variant="contained" size="large"
                loading={busy || photos.busy}
                disabled={photos.busy}
                aria-label={photos.busy ? "Waiting for the photo to upload" : undefined}
                loadingPosition="start"
                sx={{ backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
                Post to the board
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
