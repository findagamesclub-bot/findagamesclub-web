"use client";

import { useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import NextLink from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import SubmitButton from "@/components/ui/SubmitButton";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { declineFeaturedRequest, type FeaturedState } from "@/app/admin/featured/actions";
import type { FeaturedRequest } from "@/services/featuredRequests.service";
import { shortDate } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { mono, tokens } from "@/lib/tokens";

/**
 * Clubs asking to lead the homepage.
 *
 * Booking is not done here. "Book a slot" carries the club and the request
 * into the booking tab, and the slot that comes back answers the request in
 * the same press, so there is one place that knows the rules about dates and
 * overlaps rather than two.
 */
export default function FeaturedRequests({ requests }: { requests: FeaturedRequest[] }) {
  const [state, act, working] =
    useActionState<FeaturedState, FormData>(declineFeaturedRequest, {});
  useActionToast(state);
  const [asking, setAsking] = useState<FeaturedRequest | null>(null);
  useActionSuccess(state, () => setAsking(null));

  if (requests.length === 0) {
    return (
      <EmptyState
        title="Nobody has asked"
        description="A club asks from its own billing page. When one does, it lands here and every admin gets a notice."
      />
    );
  }

  return (
    <>
      <Box sx={{ display: "grid", gap: 2, alignItems: "stretch",
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)",
                   sm: "repeat(2, minmax(0, 1fr))",
                   lg: "repeat(3, minmax(0, 1fr))" } }}>
        {requests.map((request) => {
          const club = request.club;
          const { faction, monogram } = clubIdentity(club?.slug ?? "", club?.name ?? "Club");
          const open = request.status === "pending";

          return (
            <Stack key={request.id} spacing={1.25}
              sx={{ height: "100%", p: 2, borderRadius: 1.5,
                    border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                    opacity: open ? 1 : 0.72,
                    transition: "opacity 140ms ease", "&:hover": { opacity: 1 } }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                <Box aria-hidden sx={{
                  width: 38, height: 38, flexShrink: 0, borderRadius: "22%",
                  display: "grid", placeItems: "center",
                  fontFamily: mono, fontSize: "0.72rem", fontWeight: 700,
                  color: "#fff", backgroundColor: faction.base }}>
                  {monogram}
                </Box>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {club?.name ?? "A club"}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                    letterSpacing: "0.08em", color: tokens.inkMuted }}>
                    {(club?.city ?? "").toUpperCase()}
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                <StatusChip
                  label={open ? "Waiting" : request.status === "booked" ? "Booked"
                    : request.status === "declined" ? "Turned down" : "Taken back"}
                  tone={open ? "waiting" : request.status === "booked" ? "kept" : "quiet"} />
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                  color: tokens.inkMuted }}>
                  {`ASKED ${(shortDate(request.createdAt.slice(0, 10)) ?? "").toUpperCase()}`}
                </Typography>
              </Stack>

              {request.preferredFrom ? (
                <Typography variant="body2">
                  {`They would like the week of ${shortDate(request.preferredFrom)}.`}
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  No dates named, so pick what suits.
                </Typography>
              )}

              {request.note ? (
                <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                  {request.note}
                </Typography>
              ) : null}

              {request.declineReason ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {request.declineReason}
                </Typography>
              ) : null}

              {/* Footers line up however long the names above them ran. */}
              <Box sx={{ flex: 1 }} />

              {open ? (
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  <Button component={NextLink} variant="contained" size="small"
                    href={`/admin/featured?tab=book&club=${request.clubId}&request=${request.id}`}>
                    Book a slot
                  </Button>
                  <Button variant="text" size="small" color="inherit"
                    onClick={() => setAsking(request)}
                    sx={{ color: tokens.inkMuted }}>
                    Turn it down
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          );
        })}
      </Box>

      <Dialog open={asking !== null} onClose={() => setAsking(null)} fullWidth maxWidth="sm">
        <DialogTitle>{`Turn down ${asking?.club?.name ?? "this club"}?`}</DialogTitle>
        <Box component="form" action={act}>
          <input type="hidden" name="requestId" value={String(asking?.id ?? 0)} />
          <DialogContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                They are told the reason, so write it for them rather than for
                the record. They can ask again whenever they like.
              </Typography>
              <TextField name="reason" label="Why not" required fullWidth
                multiline minRows={2} autoFocus
                helperText="A full diary is a reason. So is a listing that is not finished." />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAsking(null)} color="inherit">Keep it open</Button>
            <SubmitButton label="Turn it down" pendingLabel="Sending" pending={working} />
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
