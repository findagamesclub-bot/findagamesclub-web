"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Panel from "@/components/members/Panel";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import { useActionToast } from "@/components/ui/Toaster";
import { memberCodeAction, type MemberCodeState }
  from "@/app/account/profile/actions";
import { formatMemberCode } from "@/utils/member-code";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * The one piece of this account that somebody else has to be able to read.
 *
 * A tournament organiser is standing at a desk with a queue behind them, so
 * the code is the loudest thing in the panel: mono, brass, and far above body
 * size, set in the two chunks it gets read aloud in. Brass is the data
 * emphasis colour everywhere else in this product and this is data somebody
 * reads off a screen, which is exactly what it is for.
 *
 * The sentence underneath leads with what it buys rather than what it is,
 * because "your member code" means nothing on its own.
 */
export default function MemberCodePanel({ code }: { code: string | null }) {
  const [state, submit, busy] = useActionState<MemberCodeState, FormData>(
    memberCodeAction, {});
  useActionToast(state);

  const [confirming, setConfirming] = useState(false);
  // Three states, not two. A clipboard write can be refused by the browser
  // and the first version answered that by leaving the label on "Copy",
  // which is a button that looks like it did nothing. Selecting the code
  // always works, so a refused copy still leaves something to press Cmd+C on
  // and the label says which happened.
  const [copied, setCopied] = useState<"no" | "clipboard" | "selected">("no");
  const codeRef = useRef<HTMLElement>(null);

  // Closed by the answer landing, never by the click.
  useActionSuccess(state, () => setConfirming(false));

  const showing = state.code ?? code;

  const rotate = () => {
    const data = new FormData();
    data.set("intent", "rotate");
    startTransition(() => submit(data));
  };

  const select = () => {
    const node = codeRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const copy = () => {
    if (!showing) return;
    // Always first, and never inside a try: this is the half that cannot fail,
    // so a refused clipboard still leaves the code selected to copy by hand.
    select();

    let answered = false;
    const settle = (how: "clipboard" | "selected") => {
      if (answered) return;
      answered = true;
      setCopied(how);
      window.setTimeout(() => setCopied("no"), 2500);
    };

    // `writeText` can throw outright rather than returning a rejected promise,
    // depending on the browser and the permission state, and an uncaught throw
    // here would kill the handler on the line after the selection and leave
    // the label on "Copy" for ever. Not observed on this machine, where it
    // resolves; caught because the failure mode is a button that looks dead.
    let written: Promise<void> | undefined;
    try {
      written = navigator.clipboard?.writeText(formatMemberCode(showing));
    } catch {
      settle("selected");
      return;
    }
    if (!written) { settle("selected"); return; }

    written.then(() => settle("clipboard"), () => settle("selected"));
    // And it can sit there resolving neither way, waiting on a permission
    // nothing ever asks for. The selection has already happened by now, so say
    // that rather than keep waiting.
    window.setTimeout(() => settle("selected"), 500);
  };

  return (
    <Panel title="Your member code">
      <ConfirmDialog
        open={confirming}
        title="Get a new code?"
        body={"The one you have now stops working straight away. Anything already "
          + "on your profile stays there: a club only needs the code at the moment "
          + "they attach a result, never afterwards."}
        confirmLabel="Get a new code"
        cancelLabel="Keep this one"
        busy={busy}
        onConfirm={rotate}
        onClose={() => setConfirming(false)}
      />

      {showing ? (
        <Stack direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1.5, sm: 2 }}
          sx={{ alignItems: { xs: "stretch", sm: "center" }, mb: 1.5 }}>
          <Box
            ref={codeRef}
            sx={{
              fontFamily: mono,
              fontSize: { xs: "1.5rem", sm: "1.75rem" },
              letterSpacing: "0.12em",
              color: tokens.brass,
              lineHeight: 1.2,
              // Selectable as one run, because somebody will drag over it
              // rather than find the button.
              userSelect: "all",
            }}
          >
            {formatMemberCode(showing)}
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={copy}
            startIcon={copied === "clipboard" ? <CheckIcon /> : <ContentCopyIcon />}
            sx={{ alignSelf: { xs: "flex-start", sm: "center" }, minWidth: 108 }}
          >
            {copied === "clipboard" ? "Copied"
              : copied === "selected" ? "Selected" : "Copy"}
          </Button>
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted, mb: 1.5 }}>
          Your code could not be loaded just now. Refresh the page and it will
          be here.
        </Typography>
      )}

      {copied === "selected" ? (
        <Typography sx={{
          fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
          color: tokens.danger, mb: 1,
        }}>
          Your browser would not let the page copy it. It is selected now, so
          copy it with your keyboard.
        </Typography>
      ) : null}

      <Typography variant="body2" sx={{ color: tokens.inkMuted, maxWidth: "62ch" }}>
        Give this to whoever is running an event you play at, and your results
        there land on your profile: your record, your podium finishes and the
        badges that come with them. It works at any club, not only the ones you
        have joined.
      </Typography>

      <Typography sx={{
        mt: 1, fontSize: "0.75rem", fontFamily: display, lineHeight: 1.6,
        color: tokens.inkMuted, maxWidth: "62ch",
      }}>
        It says nothing about you on its own, and nobody can look you up by
        name. Change it whenever you like.
      </Typography>

      {showing ? (
        <Box sx={{ mt: 1.5 }}>
          <Button variant="text" size="small" disabled={busy}
            onClick={() => setConfirming(true)}
            sx={{ color: tokens.inkMuted, px: 0 }}>
            Get a new code
          </Button>
        </Box>
      ) : null}
    </Panel>
  );
}
