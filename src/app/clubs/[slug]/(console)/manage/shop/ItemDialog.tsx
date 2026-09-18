"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import AddPhotoIcon from "@mui/icons-material/AddPhotoAlternate";
import SubmitButton from "@/components/ui/SubmitButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useClubImage } from "@/hooks/useClubImage";
import {
  MAX_ITEM_CATEGORY, MAX_ITEM_DESCRIPTION, MAX_ITEM_NAME, MAX_ITEM_PRICE,
} from "@/utils/shop-item";
import { tokens } from "@/lib/tokens";
import type { EditableItem } from "@/repositories/shopEditor.repository";

export type ItemTier = { key: string; label: string };

/**
 * One shop item, everything except its sizes.
 *
 * Legacy edits this as a row of bare inputs inside the listing editor
 * (main.js:19295). The fields are the same; they are here instead because this
 * is the page a club opens to run its shop, and a dialog can give a price and
 * a description room to be read.
 */
export default function ItemDialog({
  open, onClose, slug, clubId, item, tiers, action, remove,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  clubId: number;
  /** Null when this is a new item. */
  item: EditableItem | null;
  tiers: ItemTier[];
  action: (data: FormData) => void;
  /** Absent for a new item: there is nothing to remove yet. */
  remove?: () => void;
}) {
  const fullScreen = useMediaQuery("(max-width:600px)");
  const picker = useRef<HTMLInputElement>(null);
  const image = useClubImage(clubId, "shop", item?.image?.src ?? "");

  const [active, setActive] = useState(item?.active ?? true);
  const [tier, setTier] = useState(item?.minimumTierKey ?? "");
  const [asking, setAsking] = useState(false);

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <Box component="form" action={action}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="itemId" value={item?.id ?? ""} />
          <input type="hidden" name="active" value={active ? "yes" : "no"} />
          <input type="hidden" name="minimumTierKey" value={tier} />
          <input type="hidden" name="imageSrc" value={image.src} />

          <DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2.5}>
              <TextField name="name" label="Name" defaultValue={item?.name ?? ""} required
                fullWidth autoFocus slotProps={{ htmlInput: { maxLength: MAX_ITEM_NAME } }} />

              <Box sx={{ display: "grid", gap: 2,
                         gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                                sm: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
                <TextField name="price" label="Price" defaultValue={item?.price ?? ""}
                  helperText="Leave it empty and the shop says TBC."
                  slotProps={{ htmlInput: { maxLength: MAX_ITEM_PRICE } }} />
                <TextField name="category" label="Category" defaultValue={item?.category ?? ""}
                  helperText="Clothing, dice, terrain."
                  slotProps={{ htmlInput: { maxLength: MAX_ITEM_CATEGORY } }} />
              </Box>

              <TextField name="description" label="Description" multiline minRows={2} fullWidth
                defaultValue={item?.description ?? ""}
                slotProps={{ htmlInput: { maxLength: MAX_ITEM_DESCRIPTION } }} />

              <TextField select label="Who can buy it" value={tier} fullWidth
                onChange={(event) => setTier(event.target.value)}
                helperText="Approved members only, or a tier and up.">
                <MenuItem value="">All approved members</MenuItem>
                {tiers.map((row) => (
                  <MenuItem key={row.key} value={row.key}>{row.label} and up</MenuItem>
                ))}
              </TextField>

              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Box sx={{ width: 72, height: 72, flexShrink: 0, borderRadius: 1.5,
                             overflow: "hidden", display: "grid", placeItems: "center",
                             border: `1px solid ${tokens.rule}`,
                             backgroundColor: tokens.surface }}>
                    {image.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.src} alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <AddPhotoIcon sx={{ color: tokens.inkMuted }} />
                    )}
                  </Box>

                  <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      <Button variant="outlined" size="small" loading={image.busy}
                        loadingPosition="start" startIcon={<AddPhotoIcon />}
                        onClick={() => picker.current?.click()}>
                        {image.src ? "Replace picture" : "Add a picture"}
                      </Button>
                      {image.src ? (
                        <Button variant="text" size="small" onClick={image.clear}
                          sx={{ color: tokens.inkMuted }}>
                          Remove picture
                        </Button>
                      ) : null}
                    </Stack>
                    <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                      JPEG, PNG or WebP. It is resized before it is uploaded.
                    </Typography>
                  </Stack>
                </Stack>

                {image.src ? (
                  <TextField name="imageAlt" label="What is in the picture" fullWidth
                    defaultValue={item?.image?.alt ?? ""}
                    helperText="Read aloud to anybody using a screen reader." />
                ) : null}

                {image.error ? (
                  <Typography variant="body2" sx={{ color: tokens.danger }}>
                    {image.error}
                  </Typography>
                ) : null}
              </Stack>

              <FormControlLabel
                control={<Switch checked={active}
                  onChange={(event) => setActive(event.target.checked)} />}
                label={<Typography variant="body2">
                  On sale. Turn it off to keep the item without offering it.
                </Typography>} />

              {!item ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  It arrives with none in stock. Set that, and any sizes, on the
                  card once it is saved.
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
            {/* Removing is rare and permanent, so it sits away from Save. */}
            {remove ? (
              <Button variant="text" onClick={() => setAsking(true)}
                sx={{ color: tokens.danger }}>
                Remove item
              </Button>
            ) : <span />}
            <Stack direction="row" spacing={1}>
              <Button variant="text" onClick={onClose}>Cancel</Button>
              <SubmitButton label={item ? "Save item" : "Add item"} pendingLabel="Saving" />
            </Stack>
          </DialogActions>

          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void image.upload(file);
              event.target.value = "";
            }} />
        </Box>
      </Dialog>

      <ConfirmDialog open={asking} title="Remove this item?"
        body={<>
          {item ? `"${item.name}"` : "This item"} comes off your shop for good,
          with its sizes. Orders already placed keep their own record of what was
          bought. This one cannot be undone.
        </>}
        confirmLabel="Remove item" destructive
        onConfirm={() => { remove?.(); setAsking(false); onClose(); }}
        onClose={() => setAsking(false)} />
    </>
  );
}
