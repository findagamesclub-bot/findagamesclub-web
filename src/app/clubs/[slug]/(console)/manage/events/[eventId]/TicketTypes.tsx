"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import Section from "@/components/ui/Section";
import EmptyState from "@/components/ui/EmptyState";
import RemoveRow from "@/components/ui/RemoveRow";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import TicketDialog, { type TicketTier } from "./TicketDialog";
import { saveTicketsAction, type EventEditState } from "./actions";
import {
  removeTicketRefusal, soldLabel, ticketsAvailable, type TicketDraft,
} from "@/utils/event-tickets";
import { formatPrice } from "@/utils/format";
import { display, mono, tokens } from "@/lib/tokens";
import type { EditableEvent } from "@/types/eventEditor";

/**
 * What the event sells.
 *
 * The whole table posts in one save so rows can be removed and reordered, and
 * the taken count travels with each row so the refusals can be said in the
 * browser before anybody presses anything.
 */
export default function TicketTypes({
  slug, event, tiers,
}: {
  slug: string;
  event: EditableEvent;
  tiers: TicketTier[];
}) {
  const [state, submit] = useActionState<EventEditState, FormData>(saveTicketsAction, {});
  useActionToast(state);

  const [rows, setRows] = useState<TicketDraft[]>(event.ticketTypes.map((row) => ({
    id: row.id, label: row.label, price: row.price,
    quantityAvailable: row.quantityAvailable, audience: row.audience,
    minimumTierKey: row.minimumTierKey,
  })));
  // Null means new; undefined means the dialog is shut, which is a third state
  // rather than a second boolean.
  const [editing, setEditing] = useState<TicketDraft | null | undefined>(undefined);

  const takenOf = (id: number | null) =>
    id === null ? 0 : event.ticketTypes.find((row) => row.id === id)?.taken ?? 0;
  const tierLabel = (key: string) => tiers.find((tier) => tier.key === key)?.label;

  const save = (row: TicketDraft) => {
    setRows((current) => {
      const at = current.findIndex((seen) =>
        seen === editing || (row.id !== null && seen.id === row.id));
      if (at === -1) return [...current, row];
      const next = [...current];
      next[at] = row;
      return next;
    });
    setEditing(undefined);
  };

  const total = ticketsAvailable(rows);

  return (
    <Section title="Tickets" icon={ConfirmationNumberIcon} navLabel="Tickets"
      note={total === null
        ? "Nothing is capped, so the event takes as many as turn up."
        : `${total} places in total across every ticket type.`}>
      <Box component="form" action={submit}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={event.id} />

        <Stack spacing={1.5}>
          {rows.length === 0 ? (
            <EmptyState
              title="No tickets yet"
              description="Add a ticket type and people can book. Without one the event is an announcement, not something anybody can take a place at."
            />
          ) : null}

          {rows.map((row, index) => {
            const taken = takenOf(row.id);
            const stop = removeTicketRefusal(row.label, taken);
            const sold = soldLabel(taken, row.quantityAvailable);

            return (
              <Box key={row.id ?? `new-${index}`}
                sx={{ display: "grid", gap: 1.25, alignItems: "center", p: 1.75,
                      borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                      backgroundColor: tokens.paper,
                      gridTemplateColumns: { xs: "minmax(0, 1fr) auto",
                                             sm: "minmax(0, 1.4fr) minmax(0, 1fr) auto auto" } }}>
                <input type="hidden" name="ticketId" value={row.id ?? ""} />
                <input type="hidden" name="ticketLabel" value={row.label} />
                <input type="hidden" name="ticketPrice" value={row.price} />
                <input type="hidden" name="ticketQuantity"
                  value={row.quantityAvailable === null ? "" : row.quantityAvailable} />
                <input type="hidden" name="ticketAudience" value={row.audience} />
                <input type="hidden" name="ticketTier" value={row.minimumTierKey} />

                <Stack spacing={0.3} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700 }}
                    noWrap>
                    {row.label}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                                    letterSpacing: "0.08em", color: tokens.inkMuted }}>
                    {[formatPrice(row.price) ?? "Free",
                      row.audience === "members"
                        ? (tierLabel(row.minimumTierKey)
                            ? `${tierLabel(row.minimumTierKey)} AND ABOVE` : "MEMBERS ONLY")
                        : "OPEN TO ALL"].join(" · ").toUpperCase()}
                  </Typography>
                </Stack>

                <Typography variant="body2"
                  sx={{ color: tokens.inkMuted, minWidth: 0,
                        gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                  {sold ?? (row.quantityAvailable === null
                    ? "No limit"
                    : row.quantityAvailable === 0 ? "Closed"
                    : `${row.quantityAvailable} available`)}
                </Typography>

                <Button size="small" variant="outlined" onClick={() => setEditing(row)}
                  sx={{ justifySelf: "end", flexShrink: 0 }}>
                  Edit
                </Button>

                <RemoveRow what="ticket" disabled={Boolean(stop)}
                  body={stop ?? `${row.label} goes when you save. Nobody holds one, so nothing is lost.`}
                  onRemove={() => setRows((current) => current.filter((seen) => seen !== row))}
                />
              </Box>
            );
          })}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
            sx={{ justifyContent: "space-between", pt: 0.5 }}>
            <Button startIcon={<AddIcon />} variant="outlined"
              onClick={() => setEditing(null)} sx={{ alignSelf: { sm: "flex-start" } }}>
              Add a ticket type
            </Button>
            <SubmitButton label="Save tickets" pendingLabel="Saving the tickets" size="medium" />
          </Stack>
        </Stack>
      </Box>

      {editing !== undefined ? (
        <TicketDialog open row={editing} taken={takenOf(editing?.id ?? null)} tiers={tiers}
          onClose={() => setEditing(undefined)} onSave={save} />
      ) : null}
    </Section>
  );
}
