"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveRow from "@/components/ui/RemoveRow";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { saveSizesAction, type ShopEditState } from "./actions";
import { addRefusal, MAX_SIZE_LABEL, sizesRefusal } from "@/utils/shop-sizes";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { EditableItem } from "@/repositories/shopEditor.repository";

type Row = {
  /** Stable across renders. A new size has no database id until it is saved. */
  key: string;
  id: number | null;
  label: string;
  /**
   * Held as typed, not as a number. Coercing on every keystroke turned an
   * emptied box straight back into "0", so backspace could never clear it.
   */
  stock: string;
  active: boolean;
};

/**
 * One item, and how many of each size are left.
 *
 * A size with an empty name is the item itself, which is what every item had
 * before sizes existed. Naming it turns the item into a sized one, and the
 * shop starts asking members to choose.
 *
 * The picture is here because counting stock means holding the thing: a club
 * with four jumpers in three colours cannot tell them apart by name alone, and
 * the shop page has shown the picture all along.
 */
export default function ItemSizes({
  slug, item, faction, tierLabel, onEdit,
}: {
  slug: string;
  item: EditableItem;
  faction: Faction;
  /** The tier this item is kept for, if it is kept for one. */
  tierLabel?: string;
  onEdit: () => void;
}) {
  const [state, submit] = useActionState<ShopEditState, FormData>(saveSizesAction, {});
  useActionToast(state);

  const [sizes, setSizes] = useState<Row[]>(() =>
    item.sizes.map((size) => ({ ...size, stock: String(size.stock), key: `s${size.id}` })));
  const [dropped, setDropped] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [draftStock, setDraftStock] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const total = sizes.filter((s) => s.active)
    .reduce((n, s) => n + (Number(s.stock) || 0), 0);

  // Shut, the card still carries the count per size. Folding the numbers away
  // on the screen whose job is counting them would be worse than a long page.
  const perSize = sizes
    .filter((size) => size.label.trim())
    .map((size) => `${size.label.trim()} ${Number(size.stock) || 0}${size.active ? "" : " OFF"}`)
    .join("  ·  ");
  const image = imageFailed ? null : item.image;

  const set = (index: number, patch: Partial<Row>) =>
    setSizes((held) => held.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  /**
   * A size and how many you have, added together.
   *
   * Adding the name first and revealing the count afterwards made people go
   * back up the card to finish a job they thought they had done.
   */
  function add() {
    const clean = draft.trim();
    if (!clean) {
      setProblem(draftStock.trim() ? "Give the size a name." : null);
      return;
    }

    const refusal = addRefusal(sizes, clean);
    if (refusal) { setProblem(refusal); return; }

    setSizes((held) => [...held, {
      key: `n${crypto.randomUUID()}`, id: null, label: clean,
      stock: draftStock.trim(), active: true,
    }]);
    setDraft("");
    setDraftStock("");
    setProblem(null);
  }

  function remove(index: number) {
    const going = sizes[index];
    if (!going) return;
    setSizes((held) => held.filter((_, i) => i !== index));
    if (going.id) setDropped((held) => [...held, going.id as number]);
    setProblem(null);
  }

  return (
    <Box component="form" action={submit}
      sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden",
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="itemId" value={item.id} />
      {dropped.map((id) => (
        <input key={id} type="hidden" name="droppedSizeId" value={id} />
      ))}

      {/* The header is built rather than an AccordionSummary, which is one
          large button and cannot hold the pencil inside it. Three siblings: a
          wide target that opens the sizes, edit, and the chevron. */}
      <Stack direction="row" spacing={1} sx={{ p: 2, alignItems: "center" }}>
      <ButtonBase onClick={() => setOpen((was) => !was)} aria-expanded={open}
        aria-label={`Sizes for ${item.name}`}
        sx={{ flex: 1, minWidth: 0, display: "flex", gap: 2, borderRadius: 1.5,
              alignItems: "flex-start", textAlign: "left", p: 0.5, m: -0.5 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", minWidth: 0, flex: 1 }}>
        <Box sx={{ width: 84, height: 84, flexShrink: 0, borderRadius: 1.5,
                   overflow: "hidden", display: "grid", placeItems: "center",
                   backgroundImage:
                     `linear-gradient(140deg, ${faction.deep} 0%, ${faction.base} 100%)` }}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.src} alt={image.alt} onError={() => setImageFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Typography sx={{ fontFamily: display, fontWeight: 800, fontSize: "1.8rem",
                              color: "rgba(255,255,255,0.3)" }}>
              {item.name.trim().charAt(0).toUpperCase() || "?"}
            </Typography>
          )}
        </Box>

        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
            <Typography sx={{ fontFamily: display, fontSize: "1rem", fontWeight: 700,
                              minWidth: 0 }}>
              {item.name}
            </Typography>
            {item.price ? (
              <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                                flexShrink: 0 }}>
                {item.price}
              </Typography>
            ) : null}
          </Stack>

          {/* Everything the club needs to know about this item at a glance, and
              nothing it can edit here: adding an item is a different job. */}
          <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", letterSpacing: "0.08em",
                            color: total > 0 ? tokens.inkMuted : tokens.brass }}>
            {[
              item.category.toUpperCase(),
              `${total} IN STOCK`,
              item.active ? "" : "RETIRED",
              tierLabel ? `${tierLabel.toUpperCase()} AND UP` : "",
            ].filter(Boolean).join(" · ")}
          </Typography>
          {perSize ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", fontWeight: 700,
                              letterSpacing: "0.06em", color: tokens.ink, pt: 0.25 }}>
              {perSize}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
      </ButtonBase>

      <Tooltip title="Edit item">
        <IconButton aria-label={`Edit ${item.name}`} size="small" onClick={onEdit}
          sx={{ flexShrink: 0, color: tokens.inkMuted,
                "&:hover": { color: tokens.brand } }}>
          <EditIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>

      <IconButton size="small" onClick={() => setOpen((was) => !was)}
        aria-label={open ? `Hide the sizes for ${item.name}` : `Show the sizes for ${item.name}`}
        sx={{ flexShrink: 0, color: tokens.inkMuted }}>
        <ExpandMoreIcon sx={{ fontSize: 22,
          transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />
      </IconButton>
      </Stack>

      <Collapse in={open} unmountOnExit={false}>
      <Stack spacing={1.5}
        sx={{ px: 2, pt: 2, pb: 2, borderTop: `1px solid ${tokens.rule}` }}>
        {sizes.map((size, index) => (
          // Two lines on a phone, one on a laptop. Three loose controls in a
          // column gave no sign where one size ended and the next began.
          <Box key={size.key}
            sx={{ display: "grid", gap: 1.25, alignItems: "center",
                  pb: index < sizes.length - 1 ? 1.5 : 0,
                  borderBottom: index < sizes.length - 1
                    ? `1px solid ${tokens.rule}` : "none",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr) 88px",
                    sm: "minmax(0, 1.4fr) minmax(0, 0.6fr) auto auto" } }}>
            <input type="hidden" name="sizeId" value={size.id ?? ""} />
            <input type="hidden" name="sizeActive" value={size.active ? "yes" : "no"} />
            <TextField size="small" name="sizeLabel" label="Size" value={size.label}
              onChange={(e) => set(index, { label: e.target.value })}
              slotProps={{ htmlInput: { maxLength: MAX_SIZE_LABEL } }}
              placeholder="Leave empty for no sizes" />
            <TextField size="small" name="sizeStock" label="Left" value={size.stock}
              inputMode="numeric"
              onChange={(e) => set(index, { stock: e.target.value.replace(/[^0-9]/g, "") })} />
            <FormControlLabel
              sx={{ m: 0 }}
              control={<Switch size="small" checked={size.active}
                onChange={(e) => set(index, { active: e.target.checked })} />}
              label={<Typography variant="body2">On sale</Typography>} />
            {/* The last one cannot go: an item with no sizes cannot be bought
                at all, and that is not something to discover from the shop. */}
            <RemoveRow what="size" disabled={sizes.length === 1}
              sx={{ justifySelf: "end" }}
              confirm={Boolean(size.id) || Number(size.stock) > 0}
              body={<>
                {size.label.trim() ? `Size "${size.label.trim()}"` : "This size"} comes
                off {item.name}
                {Number(size.stock) > 0
                  ? `, and the ${size.stock} you have left stop counting` : ""}.
                Orders already placed keep the size they named. Nothing changes until
                you save.
              </>}
              onRemove={() => remove(index)} />
          </Box>
        ))}

        {/* Still part of the form: a size typed here and never added is picked
            up by the save rather than thrown away. */}
        <input type="hidden" name="newSizeLabel" value={draft} />
        <input type="hidden" name="newSizeStock" value={draftStock} />

        <Box sx={{ display: "grid", gap: 1.25, alignItems: "center",
                   gridTemplateColumns: {
                     xs: "minmax(0, 1fr) 88px",
                     sm: "minmax(0, 1.4fr) minmax(0, 0.6fr) auto auto" } }}>
          <TextField size="small" label="Add a size" value={draft}
            onChange={(e) => { setDraft(e.target.value); setProblem(null); }}
            // Enter in a form submits it. In here it means "add this one".
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            error={Boolean(problem)}
            slotProps={{ htmlInput: { maxLength: MAX_SIZE_LABEL } }} />
          <TextField size="small" label="Left" value={draftStock} inputMode="numeric"
            onChange={(e) => setDraftStock(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <Button variant="outlined" size="medium" startIcon={<AddIcon />} onClick={add}
            sx={{ gridColumn: { xs: "1 / -1", sm: "3 / -1" } }}>
            Add
          </Button>
        </Box>

        <Typography variant="body2"
          sx={{ color: problem ? tokens.danger : tokens.inkMuted, mt: -0.5 }}>
          {problem ?? "Press Enter or Add. An item always keeps at least one size."}
        </Typography>

        {/* The same rules the save runs, said while there is still a form to
            fix rather than after a round trip. */}
        {sizesRefusal(sizes) ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", letterSpacing: "0.06em",
                            color: tokens.brass }}>
            {sizesRefusal(sizes)?.toUpperCase()}
          </Typography>
        ) : null}
      </Stack>

      <Stack direction="row"
        sx={{ px: 2, py: 1.5, justifyContent: "flex-end",
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        <SubmitButton label="Save sizes" pendingLabel="Saving" />
      </Stack>
      </Collapse>
    </Box>
  );
}
