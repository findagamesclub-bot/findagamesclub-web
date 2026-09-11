"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import EmptyState from "@/components/ui/EmptyState";
import { useActionToast } from "@/components/ui/Toaster";
import ItemDialog, { type ItemTier } from "./ItemDialog";
import ItemSizes from "./ItemSizes";
import { deleteItemAction, saveItemAction, type ShopEditState } from "./actions";
import type { Faction } from "@/lib/tokens";
import type { EditableItem } from "@/repositories/shopEditor.repository";

/**
 * The club's shop: what it sells, and how many of each size are left.
 *
 * One dialog serves both New item and Edit, because they are the same eight
 * fields and a club that has met one has met the other.
 */
export default function ShopEditor({
  slug, clubId, items, faction, tiers,
}: {
  slug: string;
  clubId: number;
  items: EditableItem[];
  faction: Faction;
  tiers: ItemTier[];
}) {
  const [state, submit, saving] = useActionState<ShopEditState, FormData>(saveItemAction, {});
  const [gone, removing] = useActionState<ShopEditState, FormData>(deleteItemAction, {});
  useActionToast(state);
  useActionToast(gone);

  // Null means new. Undefined means the dialog is shut, which is not the same
  // thing and was worth a third state rather than a second boolean.
  const [editing, setEditing] = useState<EditableItem | null | undefined>(undefined);

  const label = (key: string) => tiers.find((tier) => tier.key === key)?.label;

  // The dialog stays up while the save runs, so the button can show a spinner
  // and a refusal lands with the form still holding what was typed. It closes
  // itself once the save comes back clean.
  const started = useRef(false);
  useEffect(() => {
    if (saving) { started.current = true; return; }
    if (!started.current) return;
    started.current = false;
    if (!state.error) setEditing(undefined);
  }, [saving, state]);

  const remove = (itemId: number) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("itemId", String(itemId));
    startTransition(() => removing(data));
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing(null)}>
          New item
        </Button>
      </Stack>

      {items.length ? (
        <Box sx={{ display: "grid", gap: 2, alignItems: "start",
                   gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                          md: "repeat(2, minmax(0, 1fr))" } }}>
          {items.map((item) => (
            <ItemSizes key={item.id} slug={slug} item={item} faction={faction}
              tierLabel={label(item.minimumTierKey)}
              onEdit={() => setEditing(item)} />
          ))}
        </Box>
      ) : (
        <EmptyState
          title="Nothing in the shop"
          description="Add a shirt, a set of dice, anything the club sells. Sizes and stock come next, on the item's own card."
        />
      )}

      {editing !== undefined ? (
        <ItemDialog
          open
          onClose={() => setEditing(undefined)}
          slug={slug}
          clubId={clubId}
          item={editing}
          tiers={tiers}
          action={submit}
          remove={editing ? () => remove(editing.id) : undefined}
        />
      ) : null}
    </Stack>
  );
}
