"use client";

import { startTransition, useActionState, useState } from "react";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { useActionToast } from "@/components/ui/Toaster";
import { requestTierAction, type UpgradeState } from "@/app/account/memberships/actions";
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
  // in the same list is how somebody picks the wrong one.
  const mine = membership.tiers.find((tier) => tier.key === membership.tierKey) ?? null;
  const minePosition = mine ? membership.tiers.indexOf(mine) : -1;
  const higher = membership.tiers.filter((_, i) => i > minePosition);

  const [wanted, setWanted] = useState(higher[0]?.key ?? "");

  const send = (tierKey: string) => {
    const data = new FormData();
    data.set("membershipId", String(membership.membershipId));
    data.set("tierKey", tierKey);
    startTransition(() => submit(data));
  };

  if (membership.requestedTierKey) {
    return (
      <Stack spacing={1}>
        <Typography variant="body2">
          You have asked to move to{" "}
          <strong>{membership.requestedTierLabel ?? membership.requestedTierKey}</strong>.
          The club will change it when they are ready.
        </Typography>
        <Button size="small" variant="text" loading={busy} onClick={() => send("")}
          sx={{ alignSelf: "flex-start", minWidth: 0, color: tokens.inkMuted }}>
          Withdraw the request
        </Button>
      </Stack>
    );
  }

  // Nothing to offer, so no footer at all. "This is the top tier" in a strip
  // of its own reads as an action the card is inviting, and it is not one.
  if (!higher.length) return null;

  return (
    <Stack spacing={1.25}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        MOVE UP A TIER
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}
        sx={{ alignItems: { sm: "center" } }}>
        <TextField
          select size="small" label="New tier" value={wanted}
          onChange={(event) => setWanted(event.target.value)}
          sx={{ minWidth: 190 }}
        >
          {higher.map((tier) => (
            <MenuItem key={tier.key} value={tier.key}>
              {tier.label}{tier.price ? ` · ${tier.price}` : ""}
            </MenuItem>
          ))}
        </TextField>

        <Button size="small" variant="contained" loading={busy}
          disabled={!wanted}
          startIcon={<ArrowUpwardIcon sx={{ fontSize: 16 }} />}
          onClick={() => send(wanted)}>
          Request this tier
        </Button>
      </Stack>

      {/* "Ask the club" left people wondering what the button actually did.
          A tier decides what you pay, so it says plainly that nothing moves
          until the club agrees. */}
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        The club has to agree. Nothing changes and nothing is charged until they do.
      </Typography>
    </Stack>
  );
}
