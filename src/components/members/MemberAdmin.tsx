"use client";

import { useActionState, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";
import { changeTierAction, dismissTierRequestAction, recordPaymentAction, setJoinDateAction }
  from "@/app/clubs/[slug]/membership-actions";
import MemberJoinDate from "./MemberJoinDate";
import MemberTierPicker from "./MemberTierPicker";
import PaymentHistory from "./PaymentHistory";
import RecordPayment from "./RecordPayment";
import { useActionToast } from "@/components/ui/Toaster";
import { shortDate, sinceLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { MembershipTier } from "@/types/clubDetail";
import type { MembershipPayment, PaymentStanding } from "@/types/payment";

type Props = {
  membershipId: number;
  slug: string;
  memberName: string;
  tierKey: string | null;
  /** A tier this member has asked to move to. */
  requestedTierKey?: string | null;
  tierRequestedAt?: string | null;
  tiers: MembershipTier[];
  standing: PaymentStanding;
  payments: MembershipPayment[];
  faction: Faction;
  /** What is stored as their join date, which the club can put right. */
  joinedAt?: string | null;
  /** The club's own day, for the years this dialog counts. */
  today: string;
  /**
   * The roster card says nothing about money, so this carries its own standing
   * line. The Memberships card already states it underneath, and the same date
   * twice one line apart reads as a bug.
   */
  showStatus?: boolean;
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/**
 * Owner-only controls for one member: which tier they are on, and their money.
 *
 * In a dialog rather than expanding the card. The roster is a grid, so growing
 * one card stretches every card in its row — and the tier change, the payment
 * form and the history are three things that want to be looked at together
 * rather than squeezed into a 320px column.
 */
export default function MemberAdmin({
  membershipId, slug, memberName, tierKey, requestedTierKey = null,
  tierRequestedAt = null, tiers, standing, payments, faction,
  joinedAt = null, today, showStatus = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const fullScreen = useMediaQuery("(max-width:600px)");

  const [tierState, changeTier, changingTier] = useActionState(changeTierAction, {});
  const [dismissState, dismiss, dismissing] = useActionState(dismissTierRequestAction, {});
  const [payState, recordPayment, paying] = useActionState(recordPaymentAction, {});
  const [joinState, setJoinDate, savingJoin] = useActionState(setJoinDateAction, {});

  useActionToast(tierState);
  useActionToast(payState);
  useActionToast(dismissState);
  useActionToast(joinState);

  const tier = tiers.find((t) => t.key === tierKey) ?? null;
  const options = tier?.billingOptions ?? [];

  /**
   * What the picker is showing, which is not the same question as what the
   * member holds. Seeded from the saved tier and re-seeded whenever that moves,
   * so a change the club saves leaves the picker agreeing with the row rather
   * than holding whatever was on screen before.
   */
  const [picked, setPicked] = useState(tierKey ?? tiers[0]?.key ?? "");
  const [seenTier, setSeenTier] = useState(tierKey);
  if (seenTier !== tierKey) {
    setSeenTier(tierKey);
    setPicked(tierKey ?? tiers[0]?.key ?? "");
  }


  const paidThrough = shortDate(standing.paidThrough);
  const status = !options.length
    ? { text: "FREE TIER", colour: tokens.inkMuted }
    : standing.settledOneOff
      ? { text: "ONE-OFF FEE PAID", colour: tokens.positive }
      : !paidThrough
        ? { text: "NOT PAID", colour: tokens.danger }
        : standing.overdue
          ? { text: `LAPSED ${paidThrough.toUpperCase()}`, colour: tokens.danger }
          : { text: `PAID TO ${paidThrough.toUpperCase()}`, colour: tokens.positive };

  return (
    <Box sx={{ borderTop: `1px solid ${tokens.rule}`, pt: 1.25 }}>
      <Stack direction="row" spacing={1}
        sx={{ alignItems: "center",
              justifyContent: showStatus ? "space-between" : "flex-end" }}>
        {showStatus ? (
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                            letterSpacing: "0.06em", color: status.colour, fontWeight: 600 }}>
            {status.text}
          </Typography>
        ) : null}
        <Button size="small" variant="text" startIcon={<TuneIcon />} onClick={() => setOpen(true)}
          sx={{ color: tokens.inkMuted, fontSize: "0.78rem" }}>
          Manage
        </Button>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack direction="row" spacing={1.75} sx={{ alignItems: "center" }}>
            <Avatar sx={{ bgcolor: faction.soft, color: faction.deep, width: 44, height: 44,
                          border: `1.5px solid ${faction.base}`, fontFamily: "var(--font-display)",
                          fontWeight: 700, fontSize: "0.9rem" }}>
              {initials(memberName)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h4" component="span" sx={{ fontSize: "1.15rem" }}>{memberName}</Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                letterSpacing: "0.06em", color: status.colour, fontWeight: 600 }}>
                {tier ? `${tier.label.toUpperCase()} · ` : ""}{status.text}
              </Typography>
            </Box>
            <IconButton onClick={() => setOpen(false)} aria-label="Close" sx={{ flexShrink: 0 }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            {/* The member has asked to move. Shown first and given the
                one-press answer, because it is the only thing in this dialog
                that somebody is waiting on. */}
            {requestedTierKey ? (
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: tokens.brassSoft,
                         border: `1px solid rgba(184,134,43,0.3)` }}>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                  fontWeight: 700, letterSpacing: "0.1em", color: "#5c4310" }}>
                  {`TIER REQUESTED${tierRequestedAt ? ` · ${(sinceLabel(tierRequestedAt) ?? "").toUpperCase()}` : ""}`}
                </Typography>
                <Typography variant="body2" sx={{ color: "#5c4310", mt: 0.5, mb: 1.5 }}>
                  {memberName} has asked to move to{" "}
                  <strong>
                    {tiers.find((t) => t.key === requestedTierKey)?.label ?? requestedTierKey}
                  </strong>.
                </Typography>

                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Box component="form" action={changeTier}>
                    <input type="hidden" name="membershipId" value={membershipId} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="tierKey" value={requestedTierKey} />
                    <Button type="submit" size="small" variant="contained"
                      loading={changingTier}>
                      Move them
                    </Button>
                  </Box>
                  <Box component="form" action={dismiss}>
                    <input type="hidden" name="membershipId" value={membershipId} />
                    <input type="hidden" name="slug" value={slug} />
                    <Button type="submit" size="small" variant="text" loading={dismissing}
                      sx={{ color: "#5c4310" }}>
                      Not now
                    </Button>
                  </Box>
                </Stack>
              </Box>
            ) : null}

            {/* Before the tier and the money, because it is the oldest fact
                about a membership and because the job this exists for, a club
                correcting the room on the day it lists, is done once per
                member and then never again. */}
            <MemberJoinDate membershipId={membershipId} slug={slug}
              joinedAt={joinedAt} today={today} busy={savingJoin}
              send={setJoinDate} />

            {tiers.length > 1 ? (
              <MemberTierPicker membershipId={membershipId} slug={slug} tiers={tiers}
                saved={tierKey} picked={picked} busy={changingTier}
                onPick={setPicked} send={changeTier} />
            ) : null}

            {/* Against the tier they HOLD, which the heading says out loud.
                The picker above can be showing a change nobody has saved. */}
            <RecordPayment membershipId={membershipId} slug={slug} tierKey={tierKey}
              tierLabel={tier?.label ?? ""} options={options} busy={paying}
              send={recordPayment} />

            <Box>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted, mb: 1 }}>
                PAYMENT HISTORY
              </Typography>
              <PaymentHistory payments={payments} emptyText="Nothing recorded yet." />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
