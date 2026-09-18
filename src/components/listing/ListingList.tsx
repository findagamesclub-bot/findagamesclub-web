"use client";

import { useActionState, useState, useTransition } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PauseListing from "./PauseListing";
import ReviewHistory from "./ReviewHistory";
import { useActionToast } from "@/components/ui/Toaster";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  cancelListingAction, deleteListingAction, restartListingAction,
  type ListingFlowState,
} from "@/app/list-your-club/actions";
import { ownerCanCancel, ownerCanEdit, ownerCanRestart } from "@/utils/submission-status";
import { carryListingFrom } from "@/utils/back-link";
import type { ListingCard } from "@/services/submissions.service";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * Every club this person has tried to list, and what to do about each.
 *
 * One card per listing rather than the single resume card, because somebody
 * running one club is the likeliest person to list a second and the card
 * elsewhere can only ever point at one of them. Each row carries the one action
 * that makes sense for the state it is in, so a declined listing offers nothing
 * and a draft offers the step it stopped on.
 */
export default function ListingList({
  cards, limit, from = "",
}: {
  cards: ListingCard[];
  /**
   * Which page these cards are on, carried into the builder so its back link
   * leads out of the same door. Two pages show them and back went to whichever
   * one was hardcoded.
   */
  from?: string;
  /**
   * Show at most this many. The page that lists them all leaves it out; a page
   * that only mentions them shows the newest few and links to the rest, so
   * somebody with six does not get six cards where they expected a prompt.
   */
  limit?: number;
}) {
  const [state, stop, stopping] =
    useActionState<ListingFlowState, FormData>(cancelListingAction, {});
  const [binState, bin, binning] =
    useActionState<ListingFlowState, FormData>(deleteListingAction, {});
  const [againState, again, againing] =
    useActionState<ListingFlowState, FormData>(restartListingAction, {});
  useActionToast(state);
  useActionToast(binState);
  useActionToast(againState);

  // Which card is being started again, so one press spins one button rather
  // than every card in the grid at once.
  const [restarting, setRestarting] = useState<number | null>(null);

  // Dispatched from onSubmit inside a transition, not through the form's
  // `action` prop, which is the house pattern since React 19 resets a form once
  // its action has run.
  // Every dispatch from a click on these cards goes through this. React 19
  // warns when a useActionState action is called outside one, and the warning
  // understates it: `isPending` never flips, so the confirm dialog's spinner
  // never shows and it never closes itself.
  const [, startAction] = useTransition();

  const theme = useTheme();
  const onPhone = useMediaQuery(theme.breakpoints.down("sm"));

  // Which listing is being asked about, and which of the two questions it is.
  // A draft nobody has seen is deleted outright; one an admin has read is
  // cancelled, so the record survives.
  const [asking, setAsking] = useState<{ card: ListingCard; bin: boolean } | null>(null);

  // Which card's story is open. The card itself rather than an id, so the
  // dialog reads one object and cannot be pointed at a row that has since gone.
  const [reading, setReading] = useState<ListingCard | null>(null);

  const toneOf = (tone: string) =>
    tone === "good" ? tokens.positive
      : tone === "bad" ? tokens.danger
        : tone === "warn" ? tokens.brass : tokens.inkMuted;

  const shown = limit ? cards.slice(0, limit) : cards;
  const trail = carryListingFrom(from);

  // Every form on a card carries the door too, so stopping or deleting one
  // lands back where they were rather than in the other shell.
  const withFrom = (data: FormData) => { if (from) data.set("from", from); return data; };

  return (
    // A grid, not a column. Each card is a short, self-contained thing and a
    // stack of them ran the full width of the page for two lines of text.
    //
    // `auto-fill` rather than breakpoints, because breakpoints ask the viewport
    // and the question is how much room this grid has. Inside a narrow column,
    // or on a browser at 200% zoom, a viewport-keyed grid claims three columns
    // it has no space for or collapses to one when there is room for two. A
    // minimum card width answers it directly and is right at every size.
    //
    // `alignItems: start` so each keeps its own height: stretching them left a
    // card with a column of empty paper under one sentence.
    <Box sx={{ display: "grid", gap: 2, alignItems: "start",
               gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
      {shown.map((card) => (
        <Stack key={card.id} spacing={1.25}
          sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                backgroundColor: tokens.paper }}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
            <Typography variant="h4" sx={{ fontSize: "1.05rem" }}>
              {card.clubName}{card.city ? `, ${card.city}` : ""}
            </Typography>
            <Chip size="small"
              label={card.clubStatus === "paused" ? "Paused" : card.statusLabel}
              sx={{ bgcolor: card.clubStatus === "paused" ? tokens.brass : toneOf(card.tone),
                    color: "#fff", fontWeight: 700, fontSize: "0.68rem" }} />
          </Stack>

          {/* The club's own state wins over the request's. A request is
              approved forever; a listing is live only while it is, and this
              line said "It is live. Your club page is in the directory" about
              one the owner had paused an hour earlier. */}
          {/* Three lines and no more. A card carrying a status line, the admin's
              reason, the attempt before it and two blocks of guidance ran down
              the page, and a row of cards is only as tidy as its tallest. The
              rest is behind "What has happened", which is rule 5. */}
          <Typography variant="body2"
            sx={{ color: tokens.inkMuted, display: "-webkit-box",
                  WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>
            {card.clubStatus === "paused"
              ? "It is out of the directory at the moment. Nobody new can find it, "
                + "and your members still have everything."
              : card.next}
          </Typography>

          {/* One order on every card, whatever state it is in: the thing to do
              first, then the story, then the quiet controls, then the one that
              ends something. It drifted once already and left Delete sitting
              above Start again on a cancelled listing. */}
          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "center", flexWrap: "wrap", pt: 0.25 }} useFlexGap>
            {ownerCanEdit(card.status) ? (
              <NextLink href={`/list-your-club/${card.id}/${card.lastStep}${trail}`}
                style={{ textDecoration: "none" }}>
                <Button variant="contained" sx={{ alignSelf: "flex-start" }}>
                  {card.status === "changes_requested"
                    ? "Make the changes" : "Pick up where you left off"}
                </Button>
              </NextLink>
            ) : null}

            {/* A listing that is over is not a dead end. Starting again makes a
                new draft carrying everything they typed; the old row stays as
                the record of what was decided. */}
            {ownerCanRestart(card.status) ? (
              <Box component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setRestarting(card.id);
                  const data = withFrom(new FormData());
                  data.set("draft", String(card.id));
                  startAction(() => again(data));
                }}>
                <SubmitButton
                  label="Start again from this one"
                  pendingLabel="Opening your listing"
                  variant="contained"
                  pending={againing && restarting === card.id}
                />
              </Box>
            ) : null}

            {/* Straight into the console for this club, not the list of all of
                them. Everything about a live listing lives there, and the client
                went looking for it on this page. */}
            {card.status === "approved" ? (
              <NextLink
                href={card.clubSlug ? `/clubs/${card.clubSlug}/manage` : "/my-clubs"}
                style={{ textDecoration: "none" }}>
                <Button variant="contained" sx={{ alignSelf: "flex-start" }}>
                  Manage your club
                </Button>
              </NextLink>
            ) : null}

            {/* Everything the card used to stack, one click away: what we asked
                for each time, what it was declined for, and the attempt this one
                was started from. Only offered when there is something in it. */}
            {card.history.length > 0 || card.said || card.from ? (
              <Button variant="outlined" onClick={() => setReading(card)}
                sx={{ alignSelf: "flex-start" }}>
                What has happened
              </Button>
            ) : null}

            {/* Here as well as on the listing editor, because this is where
                somebody with a live club actually looks for it. Same component,
                so the wording and the confirmation cannot drift apart. */}
            {card.status === "approved" && card.clubSlug ? (
              <PauseListing slug={card.clubSlug}
                paused={card.clubStatus === "paused"} canPause compact />
            ) : null}

            {/* Last, because it ends something. Deletable while it is theirs
                alone, which 0101 reads as a draft nobody has seen or one they
                stopped themselves; a declined one is a decision somebody took
                and stays. Stopping is offered wherever it is allowed rather than
                only on the builder's last step. */}
            {card.status === "draft" || card.status === "cancelled" ? (
              <Button variant="text" onClick={() => setAsking({ card, bin: true })}
                sx={{ color: tokens.danger, alignSelf: "flex-start" }}>
                Delete
              </Button>
            ) : ownerCanCancel(card.status) ? (
              <Button variant="text" onClick={() => setAsking({ card, bin: false })}
                sx={{ color: tokens.inkMuted, alignSelf: "flex-start" }}>
                Stop this one
              </Button>
            ) : null}
          </Stack>
        </Stack>
      ))}

      <Dialog open={reading !== null} onClose={() => setReading(null)}
        fullWidth maxWidth="sm" fullScreen={onPhone}>
        <DialogTitle>
          {reading ? `${reading.clubName}${reading.city ? `, ${reading.city}` : ""}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {reading?.next}
            </Typography>

            {/* The attempt this one replaced. Not a second card in the grid:
                two cards with the same club name, one Declined and one Awaiting
                approval, reads as a duplicate rather than as a second go. */}
            {reading?.from ? (
              <Stack spacing={0.5}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                  letterSpacing: "0.08em", color: tokens.inkMuted }}>
                  {`ATTEMPT ${reading.attempt}`}
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  {`The one before was ${reading.from.statusLabel} on `
                    + `${shortDate(reading.from.on.slice(0, 10))}.`}
                </Typography>
                {/* In full: the dialog is what scrolls here. */}
                {reading.from.reason ? (
                  <Typography variant="body2"
                    sx={{ color: tokens.ink, whiteSpace: "pre-wrap" }}>
                    {reading.from.reason}
                  </Typography>
                ) : null}
              </Stack>
            ) : null}

            {reading && reading.history.length > 0
              ? <ReviewHistory entries={reading.history} noteLines={0} />
              : reading?.said
                ? (
                  <Typography variant="body2"
                    sx={{ color: tokens.ink, whiteSpace: "pre-wrap" }}>
                    {reading.said}
                  </Typography>
                )
                : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setReading(null)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking?.bin
          ? `Delete ${asking.card.clubName || "this listing"}?`
          : `Stop ${asking?.card.clubName || "this listing"}?`}
        body={asking?.bin
          ? asking.card.status === "cancelled"
            ? "It goes for good, with everything typed into it. Start it again first if you want any of it back."
            : "It goes for good, with everything typed into it. Nobody has seen this one but you."
          : "We have this one already, so it stays on our records as stopped. You can start again from it later and everything you typed will be there."}
        confirmLabel={asking?.bin ? "Delete it" : "Stop it"}
        destructive
        busy={asking?.bin ? binning : stopping}
        onConfirm={() => {
          const data = withFrom(new FormData());
          data.set("draft", String(asking?.card.id ?? 0));
          const dispatch = asking?.bin ? bin : stop;
          startAction(() => dispatch(data));
        }}
      />
    </Box>
  );
}
