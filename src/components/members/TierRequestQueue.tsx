"use client";

import { useActionState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { useActionToast } from "@/components/ui/Toaster";
import { changeTierAction, dismissTierRequestAction }
  from "@/app/clubs/[slug]/membership-actions";
import { initials } from "@/utils/initials";
import Avatar from "@mui/material/Avatar";
import { sinceLabel } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { ClubMember } from "@/types/membership";
import type { MembershipTier } from "@/types/clubDetail";

/**
 * Everybody waiting on a tier decision, at the top of the roster.
 *
 * The email sends an owner to their members list, and on a club with a hundred
 * members that is a page of cards with no way to tell which one asked. This is
 * the queue: it names them, says what they want and how long they have waited,
 * and answers in one press without opening anybody's card.
 */
export default function TierRequestQueue({
  members, tiers, slug,
}: {
  members: ClubMember[];
  tiers: MembershipTier[];
  slug: string;
}) {
  const [tierState, changeTier, changing] = useActionState(changeTierAction, {});
  const [dismissState, dismiss, dismissing] = useActionState(dismissTierRequestAction, {});
  useActionToast(tierState);
  useActionToast(dismissState);

  const waiting = members.filter((m) => m.requestedTierKey);
  if (!waiting.length) return null;

  return (
    <Box sx={{ mb: 4, borderRadius: 2, overflow: "hidden",
               border: `1px solid rgba(184,134,43,0.45)`, backgroundColor: tokens.brassSoft }}>
      <Stack direction="row" spacing={1.25}
        sx={{ px: 2.25, py: 1.5, alignItems: "center",
              borderBottom: `1px solid rgba(184,134,43,0.3)` }}>
        <ArrowUpwardIcon sx={{ fontSize: 17, color: "#5c4310" }} />
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: "#5c4310", flex: 1 }}>
          {`${waiting.length} TIER REQUEST${waiting.length === 1 ? "" : "S"}`}
        </Typography>
      </Stack>

      <Stack sx={{ px: 2.25, py: 0.5 }}>
        {waiting.map((member) => {
          const label = tiers.find((t) => t.key === member.requestedTierKey)?.label
            ?? member.requestedTierKey;
          const from = tiers.find((t) => t.key === member.tierKey)?.label ?? "no tier";

          return (
            <Stack key={member.membershipId} direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ py: 1.75, alignItems: { sm: "center" },
                    "&:not(:last-of-type)": {
                      borderBottom: `1px solid rgba(184,134,43,0.25)`,
                    } }}>
              <Avatar sx={{ width: 36, height: 36, fontSize: "0.82rem", flexShrink: 0,
                            bgcolor: "#fff", color: "#5c4310", fontWeight: 700 }}>
                {initials(member.fullName)}
              </Avatar>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: display, fontWeight: 700, color: "#3f2e0b" }}>
                  {member.fullName}
                </Typography>
                <Typography variant="body2" sx={{ color: "#5c4310" }}>
                  {from} → <strong>{label}</strong>
                  {member.tierRequestedAt
                    ? ` · asked ${sinceLabel(member.tierRequestedAt)}`
                    : ""}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Box component="form" action={changeTier}>
                  <input type="hidden" name="membershipId" value={member.membershipId} />
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="tierKey" value={member.requestedTierKey ?? ""} />
                  <Button type="submit" size="small" variant="contained" loading={changing}>
                    Move them
                  </Button>
                </Box>
                <Box component="form" action={dismiss}>
                  <input type="hidden" name="membershipId" value={member.membershipId} />
                  <input type="hidden" name="slug" value={slug} />
                  <Button type="submit" size="small" variant="text" loading={dismissing}
                    sx={{ color: "#5c4310" }}>
                    Not now
                  </Button>
                </Box>
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
