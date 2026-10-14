"use client";

import { startTransition, useActionState, useState } from "react";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { useActionToast } from "@/components/ui/Toaster";
import { useWhenChanged } from "@/hooks/useWhenChanged";
import { requestTierAction, type UpgradeState } from "@/app/account/memberships/actions";
import { higherTiers } from "@/utils/membership-tiers";
import { mono, tokens } from "@/lib/tokens";
import type { MyClubMembership } from "@/services/myMemberships.service";

/**
 * Ask the club to move you up a tier.
 *
 * A request, not a change: what tier somebody is on decides what they pay and
 * what they can book, so it stays the club's call. The member gets a way to
 * ask, which legacy never gave them, and a way to take the ask back.
 */
export default function UpgradeRequest({ membership }: { membership: MyClubMembership }) {
  const [state, submit, busy] = useActionState<UpgradeState, FormData>(requestTierAction, {});
  useActionToast(state);

  // Only tiers above the one they hold. Offering a downgrade beside an upgrade
  // in the same list is how somebody picks the wrong one. The browser asks the
  // same question to decide whether this card gets a footer at all.
  const higher = higherTiers(membership.tiers, membership.tierKey);

  const [wanted, setWanted] = useState(higher[0]?.key ?? "");

  // Every way the chosen tier can be paid for. 9a gave a tier a list of these
  // and derived its headline from the first; this offered the headline alone,
  // so somebody wanting to pay for a year had no way to say so and the club
  // had to guess.
  const chosen = higher.find((tier) => tier.key === wanted) ?? null;
  const terms = chosen?.billingOptions ?? [];
  const [term, setTerm] = useState("");

  // The picker re-seeds when the tier moves, during render rather than in an
  // effect: a late frame would offer the previous tier's prices against this
  // tier's name, which is the one mistake this control must not make.
  useWhenChanged([wanted], () => setTerm(terms[0]?.label ?? ""));

  const send = (tierKey: string, billingLabel = "") => {
    const data = new FormData();
    data.set("membershipId", String(membership.membershipId));
    data.set("tierKey", tierKey);
    data.set("billingLabel", billingLabel);
    startTransition(() => submit(data));
  };

  if (membership.requestedTierKey) {
    return (
      <Stack spacing={1}>
        <Typography variant="body2">
          You have asked to move to{" "}
          <strong>{membership.requestedTierLabel ?? membership.requestedTierKey}</strong>
          {membership.requestedBillingLabel
            ? <>, paying <strong>{membership.requestedBillingLabel}</strong></>
            : null}.
          {" "}The club will change it when they are ready.
        </Typography>
        <Button size="small" variant="text" loading={busy} loadingPosition="start"
          onClick={() => send("")}
          sx={{ alignSelf: "flex-start", minWidth: 0, color: tokens.inkMuted }}>
          Withdraw the request
        </Button>
      </Stack>
    );
  }

  // Nothing to offer. The browser keeps the footer off the card entirely, and
  // this is the second half of that: "this is the top tier" in a strip of its
  // own reads as an action the card is inviting, and it is not one.
  if (!higher.length) return null;

  return (
    <Stack spacing={1.25}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        MOVE UP A TIER
      </Typography>

      {/* Wraps, because this card sits in a two-column grid and the second
          picker made three controls 537px wide inside 534. A Stack spaces
          with margins, which double on a wrapped line, so the gap has to be
          a real one. */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} useFlexGap
        sx={{ flexWrap: "wrap", alignItems: { sm: "center" } }}>
        <TextField
          select size="small" label="New tier" value={wanted}
          onChange={(event) => setWanted(event.target.value)}
          sx={{ minWidth: 190 }}
        >
          {higher.map((tier) => (
            <MenuItem key={tier.key} value={tier.key}>
              {tier.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Only where the club sells more than one way to pay. A single
            option offered as a choice is a control that cannot be used. */}
        {terms.length > 1 ? (
          <TextField
            select size="small" label="How you want to pay" value={term}
            onChange={(event) => setTerm(event.target.value)}
            sx={{ minWidth: 210 }}
          >
            {terms.map((option) => (
              <MenuItem key={option.id || option.label} value={option.label}>
                {option.label}{option.price ? ` · ${option.price}` : ""}
              </MenuItem>
            ))}
          </TextField>
        ) : null}

        {/* Never shrink: it was the only child that could, so it took the
            whole shortfall and clipped its own label to "Request this tie".
            And a stretched flex child centres its label, which is rule 8. */}
        <Button size="small" variant="contained" loading={busy} loadingPosition="start"
          disabled={!wanted}
          startIcon={<ArrowUpwardIcon sx={{ fontSize: 16 }} />}
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "auto" } }}
          onClick={() => send(wanted, terms.length > 1 ? term : terms[0]?.label ?? "")}>
          Request this tier
        </Button>
      </Stack>

      {/* "Ask the club" left people wondering what the button actually did.
          A tier decides what you pay, so it says plainly that nothing moves
          until the club agrees. */}
      {terms.length === 1 && terms[0]!.price ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {`${chosen?.label} is ${terms[0]!.price}${
            terms[0]!.label ? ` · ${terms[0]!.label}` : ""}.`}
        </Typography>
      ) : null}

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        The club has to agree. Nothing changes and nothing is charged until they do.
      </Typography>
    </Stack>
  );
}
