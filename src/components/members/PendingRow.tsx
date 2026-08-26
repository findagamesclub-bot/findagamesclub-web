"use client";

import { useActionState, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import NextLink from "next/link";
import { reviewMemberAction } from "@/app/clubs/[slug]/membership-actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { ClubMember } from "@/types/membership";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/**
 * One person waiting, as a row rather than a card.
 *
 * The roster uses stacked cards because you browse it. A queue is worked
 * through, so everything an owner needs sits on one line and the buttons stay
 * at a fixed place down the right.
 *
 * Declining opens a reason box across the full width of the row rather than
 * inside the button slot — squeezed into the slot the field was narrower than
 * its own label, which collided with the outline.
 */
export default function PendingRow({
  member, faction, slug, tierLabel, askedLabel,
}: {
  member: ClubMember;
  faction: Faction;
  slug: string;
  tierLabel?: string | null;
  askedLabel?: string | null;
}) {
  const [state, review, busy] = useActionState(reviewMemberAction, {});
  const [declining, setDeclining] = useState(false);

  const firstName = member.fullName.split(" ")[0] || "they";
  const meta = [tierLabel, askedLabel ? `asked ${askedLabel}` : null].filter(Boolean).join(" · ");
  const plays = [...member.games, ...member.armies];

  const hidden = (
    <>
      <input type="hidden" name="membershipId" value={member.membershipId} />
      <input type="hidden" name="slug" value={slug} />
    </>
  );

  return (
    <Stack
      spacing={declining ? 1.75 : 0}
      sx={{
        bgcolor: tokens.paper,
        border: `1px solid ${declining ? tokens.danger : tokens.rule}`,
        borderRadius: 1.5,
        px: 2, py: 1.75,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "center" } }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0, flexShrink: 0 }}>
          <Avatar
            sx={{
              bgcolor: faction.soft, color: faction.deep, width: 44, height: 44,
              border: `1.5px solid ${faction.base}`,
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem",
            }}
          >
            {initials(member.fullName)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <NextLink href={`/members/${member.profileId}`} style={{ color: "inherit", textDecoration: "none" }}>
              <Typography variant="subtitle1" noWrap sx={{ "&:hover": { color: faction.base } }}>
                {member.fullName}
              </Typography>
            </NextLink>
            {meta ? (
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                                letterSpacing: "0.05em", color: tokens.inkMuted }}>
                {meta.toUpperCase()}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {/* Takes the slack so the buttons stay pinned right on every row. */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {plays.length ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
              {plays.slice(0, 5).map((tag) => (
                <Box key={tag} sx={{ px: 1, py: 0.3, borderRadius: 0.75, bgcolor: faction.soft,
                                     color: faction.deep, fontFamily: "var(--font-mono)",
                                     fontSize: "0.7rem", fontWeight: 600 }}>
                  {tag}
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
              No games on their profile yet.
            </Typography>
          )}
        </Box>

        {!declining ? (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <form action={review}>
              {hidden}
              <input type="hidden" name="decision" value="approve" />
              <Button type="submit" size="small" variant="contained"
                loading={busy} loadingPosition="start" startIcon={<CheckIcon />}>
                Approve
              </Button>
            </form>
            {/* Not a submit: the reason box has to open first. */}
            <Button size="small" variant="outlined" disabled={busy} startIcon={<CloseIcon />}
              onClick={() => setDeclining(true)}
              sx={{ color: tokens.ink, borderColor: tokens.rule,
                    "&:hover": { color: tokens.danger, borderColor: tokens.danger } }}>
              Decline
            </Button>
          </Stack>
        ) : null}
      </Stack>

      {declining ? (
        <form action={review}>
          {hidden}
          <input type="hidden" name="decision" value="decline" />
          <Stack spacing={1.25} sx={{ borderTop: `1px solid ${tokens.rule}`, pt: 1.75 }}>
            <TextField
              name="reason"
              size="small"
              label="Reason"
              fullWidth
              helperText={`Optional. ${firstName} will see this in their email.`}
              placeholder="We are at capacity until September."
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button size="small" variant="text" disabled={busy}
                onClick={() => setDeclining(false)} sx={{ color: tokens.inkMuted }}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="small"
                variant="contained"
                loading={busy}
                loadingPosition="start"
                startIcon={<CloseIcon />}
                sx={{
                  bgcolor: tokens.danger, color: "#FFFFFF",
                  "&:hover": { bgcolor: "#8E1E17" },
                }}
              >
                Decline request
              </Button>
            </Stack>
          </Stack>
        </form>
      ) : null}

      {/* Beside the controls, never instead of them — an owner who hits an
          error still needs a way to act on the request. */}
      {state.error ? (
        <Alert severity="error" sx={{ fontSize: "0.8rem", mt: 1.5 }}>{state.error}</Alert>
      ) : null}
    </Stack>
  );
}
