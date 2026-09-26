"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import FeaturedBookForm from "@/components/admin/FeaturedBookForm";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { featuredAction, type FeaturedState } from "@/app/admin/featured/actions";
import { formatPence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { display, mono, tokens } from "@/lib/tokens";
import type { FeaturedSlotRow } from "@/repositories/featured.repository";

/**
 * Who leads the homepage, and when.
 *
 * Dated slots rather than a flag, because a slot that ends on its own is a slot
 * nobody has to remember to take down, and a slot with a price is a row the
 * treasurer can add up. The old `spotlight` flag still fills whatever is left,
 * so the front page is never empty before anybody has bought anything.
 */
export default function FeaturedBoard({
  slots, clubs, today, defaultPricePence, defaultDays, showing,
}: {
  slots: FeaturedSlotRow[];
  clubs: { id: number; name: string; city: string }[];
  today: string;
  defaultPricePence: number;
  defaultDays: number;
  /** Which tab the address asked for. Booking a slot is a form; the slots are
   *  a list; stacking them put a form of five fields above the thing the page
   *  is usually opened to look at. */
  showing: "slots" | "book";
}) {
  const [state, act, working] =
    useActionState<FeaturedState, FormData>(featuredAction, {});
  useActionToast(state);

  // A booking made on this tab lands on the other one, so without this you
  // press Book the slot, get a toast, and the page you are looking at does not
  // change. Only from the booking tab: a removal happens on the slots tab and
  // the list under it is already right.
  const router = useRouter();
  useActionSuccess(state, () => {
    if (showing === "book") router.push("/admin/featured");
  });

  const [, start] = useTransition();
  const [ending, setEnding] = useState<FeaturedSlotRow | null>(null);

  const live = (slot: FeaturedSlotRow) =>
    slot.starts_on <= today && slot.ends_on >= today;

  return (
    <Stack spacing={2.5}>
      {showing === "book" ? (
        <FeaturedBookForm
          clubs={clubs} today={today}
          defaultPricePence={defaultPricePence} defaultDays={defaultDays}
          act={act} working={working} />
      ) : null}

      {/* No panel around the slots: the tab above already says "Slots", and a
          heading that repeats the tab you just pressed is a heading doing
          nothing. The booking form keeps its frame, because a form benefits
          from one and the other admin lists render bare. */}
      {showing === "slots" ? (
      <>
        {slots.length === 0 ? (
          <EmptyState
            title="Nobody has bought a slot"
            description="Until somebody does, the homepage leads with the clubs marked spotlight and never calls them featured."
          />
        ) : (
          <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                     gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                            sm: "repeat(2, minmax(0, 1fr))",
                                            lg: "repeat(3, minmax(0, 1fr))" } }}>
            {slots.map((slot) => {
              const name = slot.club?.name ?? "A club that has gone";
              const { faction, monogram } = clubIdentity(slot.club?.slug ?? name, name);
              return (
                <Stack key={slot.id} spacing={1.5}
                  sx={{ height: "100%", p: 2, borderRadius: 1.5,
                        border: `1px solid ${tokens.rule}`,
                        backgroundColor: tokens.paper,
                        // A slot that has finished is still worth finding, and
                        // is not worth the same weight as one running now.
                        opacity: live(slot) ? 1 : 0.72 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Box aria-hidden sx={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: 1.25,
                      display: "grid", placeItems: "center",
                      backgroundColor: faction.base, color: "#FFFFFF",
                      fontFamily: mono, fontSize: "0.78rem", fontWeight: 700 }}>
                      {monogram}
                    </Box>
                    <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontFamily: display, fontWeight: 700,
                                        fontSize: "1rem", minWidth: 0,
                                        overflow: "hidden", textOverflow: "ellipsis",
                                        whiteSpace: "nowrap" }}>
                        {name}
                      </Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                        color: tokens.inkMuted }}>
                        {`${shortDate(slot.starts_on)} to ${shortDate(slot.ends_on)}`}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }} useFlexGap>
                    {live(slot) ? (
                      <Chip size="small" label="Live now"
                        sx={{ fontSize: "0.68rem", fontWeight: 700,
                              bgcolor: tokens.positive, color: "#fff" }} />
                    ) : slot.starts_on > today ? (
                      <Chip size="small" variant="outlined" label="Booked"
                        sx={{ fontSize: "0.68rem", fontWeight: 700,
                              color: tokens.inkMuted, borderColor: tokens.rule }} />
                    ) : (
                      <Chip size="small" variant="outlined" label="Finished"
                        sx={{ fontSize: "0.68rem", fontWeight: 700,
                              color: tokens.inkMuted, borderColor: tokens.rule }} />
                    )}
                    <Chip size="small" variant="outlined"
                      label={formatPence(slot.price_pence, slot.currency)}
                      sx={{ fontSize: "0.68rem", fontWeight: 700,
                            color: tokens.inkMuted, borderColor: tokens.rule }} />
                  </Stack>

                  {slot.note ? (
                    <Typography sx={{ fontSize: "0.86rem", color: tokens.inkMuted }}>
                      {slot.note}
                    </Typography>
                  ) : null}

                  {/* Pushed down so Remove sits on the same line on every card
                      in a row, however long the note above it ran. */}
                  <Box sx={{ flex: 1 }} />
                  <Box sx={{ pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
                    <Button variant="text" size="small" onClick={() => setEnding(slot)}
                      sx={{ color: tokens.danger, ml: -1 }}>
                      Remove
                    </Button>
                  </Box>
                </Stack>
              );
            })}
          </Box>
        )}
      </>
      ) : null}

      <ConfirmDialog
        open={ending !== null}
        title={`Remove ${ending?.club?.name ?? "this slot"}?`}
        body="The slot goes for good. If it is running now the club drops off the homepage straight away; the payment stays on the record."
        confirmLabel="Remove it"
        destructive
        busy={working}
        onConfirm={() => {
          const data = new FormData();
          data.set("intent", "remove");
          data.set("slot", String(ending?.id ?? 0));
          start(() => act(data));
        }}
        onClose={() => setEnding(null)}
      />
    </Stack>
  );
}
