"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChecklistIcon from "@mui/icons-material/FactCheck";
import Panel from "@/components/members/Panel";
import HealthBar from "./HealthBar";
import HealthCheck from "./HealthCheck";
import ReviewHistory from "./ReviewHistory";
import SubmitButton from "@/components/ui/SubmitButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LongText from "@/components/ui/LongText";
import { useActionToast } from "@/components/ui/Toaster";
import {
  cancelListingAction, submitListingAction, type ListingFlowState,
} from "@/app/list-your-club/actions";
import { readinessFields, type Check } from "@/utils/listing-readiness";
import type { HistoryEntry } from "@/services/submissionReview.service";
import { mono, tokens } from "@/lib/tokens";

/**
 * Step 5 for a listing that does not exist yet: send it to us.
 *
 * Not the same screen as a live club's "Listing health", which reads the same
 * checks as a report on something already published. This one has a decision
 * at the end of it, so it leads with what is still missing and what pressing
 * the button will do.
 *
 * Legacy blocks submission until all eight checks pass. That is kept: an admin
 * reviewing a half-filled listing can only send it back, which wastes a round
 * trip for both of them.
 */
export default function SubmitStep({
  draftId, checks, base, note, history = [],
}: {
  draftId: number;
  checks: Check[];
  /** `/list-your-club/12` */
  base: string;
  /** What an admin asked for, when this one has been sent back. */
  note?: string;
  /**
   * Everything that has been asked for, not only the latest.
   *
   * The alert above carries the current ask because that is the one to act on.
   * This is the rest of it, so somebody on their third round can check they
   * have not dropped something from the first.
   */
  history?: HistoryEntry[];
}) {
  const [state, submit] = useActionState<ListingFlowState, FormData>(submitListingAction, {});
  const [stopState, stop, stopping] =
    useActionState<ListingFlowState, FormData>(cancelListingAction, {});
  useActionToast(state);
  useActionToast(stopState);

  const [confirming, setConfirming] = useState(false);

  const outstanding = checks.filter((c) => !c.ready);
  const { done, total } = readinessFields(checks);
  const ready = outstanding.length === 0;

  return (
    <Stack spacing={2.5}>
      {note ? (
        <Alert severity="warning">
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
            We asked for a couple of changes
          </Typography>
          <LongText text={note} max={200} />
        </Alert>
      ) : null}

      <Panel title="Before you send it" icon={ChecklistIcon}>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 3 }}
            sx={{ alignItems: { sm: "center" } }}>
            <Stack direction="row" spacing={0.25} sx={{ alignItems: "baseline", flexShrink: 0 }}>
              <Typography sx={{ fontFamily: mono, fontSize: "2.1rem", fontWeight: 700,
                                lineHeight: 1, color: tokens.brass }}>
                {done}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "1rem", color: tokens.inkMuted }}>
                /{total}
              </Typography>
            </Stack>

            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <HealthBar checks={checks} />
              <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {`FIELDS FILLED ACROSS ${checks.length} CHECKS`}
              </Typography>
            </Stack>
          </Stack>

          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {ready
              ? "Everything we need is here. Send it over and somebody will look at it."
              : "A few things are still missing. Each one links to the step it is on."}
          </Typography>

          <Stack spacing={1}>
            {checks.map((check) => (
              <HealthCheck key={check.key} check={check} base={base} />
            ))}
          </Stack>
        </Stack>
      </Panel>

      <Box component="form" action={submit}>
        <input type="hidden" name="draft" value={draftId} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
          sx={{ alignItems: { sm: "center" } }}>
          <SubmitButton
            label="Send it to us"
            pendingLabel="Sending your listing"
            variant="contained"
            size="large"
            blocked={!ready}
            sx={{ alignSelf: "flex-start" }}
          />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {ready
              ? "We will email you either way, usually within a few days."
              : `${outstanding.length} to finish first.`}
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <NextLink href="/account" style={{ textDecoration: "none" }}>
          <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
            Save and finish later
          </Typography>
        </NextLink>

        <Button variant="text" color="inherit" onClick={() => setConfirming(true)}
          sx={{ color: tokens.inkMuted, alignSelf: "flex-start" }}>
          Stop this listing
        </Button>
      </Stack>

      {/* Last, and that placement is the point. The job on this screen is
          finishing the listing, so Send comes first and nothing a reviewer
          typed can push it down the page. Hidden on a first attempt, where it
          would be one line saying nothing has happened yet. */}
      {history.length > 1 ? (
        <Panel title="What has happened so far">
          <ReviewHistory entries={history} />
        </Panel>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Stop this listing?"
        body="Everything you have typed goes with it and we cannot bring it back. You can always start a new one."
        confirmLabel="Stop it"
        destructive
        busy={stopping}
        onConfirm={() => {
          const data = new FormData();
          data.set("draft", String(draftId));
          stop(data);
        }}
      />
    </Stack>
  );
}
