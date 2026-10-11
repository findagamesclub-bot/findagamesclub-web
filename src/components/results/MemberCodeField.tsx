"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { lookUpCodeAction, type CodeLookupState }
  from "@/app/clubs/[slug]/member-code-actions";
import { codeProblem, formatMemberCode, looksLikeMemberCode } from "@/utils/member-code";
import { display, mono, tokens } from "@/lib/tokens";

export type Linked = {
  id: string;
  /**
   * The account's own name, when it is known: from the roster, or handed back
   * by a code lookup. Absent when a saved row is reopened, where all that is
   * stored is the id, and the line then says so rather than repeating the name
   * the club typed, which would make a wrong link unspottable.
   */
  name?: string;
  code?: string;
};

/**
 * Somebody from another club, linked by the code they handed over.
 *
 * Folded away until it is wanted. Most people on a club's results are the
 * club's own members and the picker above already finds them, so a second box
 * open by default would be a field almost nobody fills in sitting under the
 * one everybody does.
 *
 * The linked line is the same whichever way the link was made, because being
 * linked is one fact and a status drawn two ways is two things to learn.
 */
export default function MemberCodeField({
  slug, linked, onFound, onClear, unlinkedNote,
}: {
  slug: string;
  /** Whoever this row currently points at, from the picker or from a code. */
  linked: Linked | null;
  onFound: (holder: Linked) => void;
  onClear: () => void;
  /** What to say when nothing is linked. Empty renders no line at all. */
  unlinkedNote?: string;
}) {
  const [state, submit, busy] = useActionState<CodeLookupState, FormData>(
    lookUpCodeAction, {});
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  // Below the state it closes over, or the binding is still in its temporal
  // dead zone when the action lands. `BadgeBoard` shipped that fault once.
  useActionSuccess(state, () => {
    if (!state.found) return;
    onFound({ ...state.found, code: state.code });
    setOpen(false);
    setCode("");
  });

  const look = () => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("code", code);
    startTransition(() => submit(data));
  };

  if (linked) {
    return (
      <Stack direction="row" spacing={1}
        sx={{ alignItems: "flex-start", mt: 0.75, flexWrap: "wrap" }}>
        <CheckCircleIcon aria-hidden
          sx={{ fontSize: 16, color: tokens.positive, mt: "1px" }} />
        <Typography sx={{
          fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
          color: tokens.inkMuted, flex: "1 1 14rem",
        }}>
          {linked.name ? (
            <>
              Goes to <strong style={{ color: tokens.ink }}>{linked.name}</strong>&apos;s
              profile, with any badge it earns.
            </>
          ) : "Attached to an account, so it shows on their profile with any badge it earns."}
        </Typography>
        <Button variant="text" size="small" onClick={onClear}
          sx={{ fontSize: "0.75rem", color: tokens.inkMuted, py: 0, minWidth: 0 }}>
          Not them
        </Button>
      </Stack>
    );
  }

  if (!open) {
    return (
      <Box sx={{ mt: 0.5 }}>
        <Button variant="text" size="small" onClick={() => setOpen(true)}
          sx={{ fontSize: "0.75rem", px: 0, color: tokens.brass }}>
          Not one of your members? Use their member code
        </Button>
        {unlinkedNote ? (
          <Typography sx={{
            fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
            color: tokens.inkMuted,
          }}>
            {unlinkedNote}
          </Typography>
        ) : null}
      </Box>
    );
  }

  const typed = codeProblem(code);
  const ready = looksLikeMemberCode(code);

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <TextField
          label="Member code" size="small" value={code} autoFocus
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter" && ready && !busy) {
              event.preventDefault();
              look();
            }
          }}
          error={Boolean(typed) || Boolean(state.error)}
          helperText={typed ?? state.error ?? "Eight characters."}
          slotProps={{ htmlInput: { maxLength: 12, style: { fontFamily: mono,
            letterSpacing: "0.08em" } } }}
          sx={{ flex: "1 1 auto", maxWidth: 220 }}
        />
        <Button variant="outlined" size="small" disabled={!ready || busy}
          onClick={look} sx={{ mt: 0.5 }}>
          {busy ? "Checking" : "Check"}
        </Button>
      </Stack>
      <Typography sx={{
        mt: 0.5, fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
        color: tokens.inkMuted, maxWidth: "46ch",
      }}>
        They find it on their own profile page and give it to you. It works
        whichever club they belong to{code && ready ? ` (${formatMemberCode(code)})` : ""}.
      </Typography>
      <Button variant="text" size="small" onClick={() => { setOpen(false); setCode(""); }}
        sx={{ fontSize: "0.75rem", px: 0, color: tokens.inkMuted }}>
        Never mind
      </Button>
    </Box>
  );
}
