"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import LinkButton from "@/components/ui/LinkButton";
import type { FlagRow } from "@/services/moderation.service";
import { targetLabel } from "@/utils/moderation-targets";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * One report, read in context.
 *
 * Full screen under 600, because an admin answering a report at eleven at night
 * is on a phone and the thing they have to read is somebody's paragraph.
 *
 * The words come first and the buttons after them, the same order the
 * submission review screen settled on: the answer is what the page is for, and
 * putting it above the thing being judged invites answering without reading.
 */
export default function ModerationDialog({
  flag, busy, onAnswer, onClose, authorBase = "/admin/accounts", canReopen = false,
}: {
  flag: FlagRow | null;
  busy: boolean;
  onAnswer: (action: "keep" | "remove", reason: string) => void;
  onClose: () => void;
  /**
   * Where the author's name goes. An admin gets `/admin/accounts`, which is
   * where suspending somebody lives; a club gets `/members`, the profile any
   * clubmate can already open. Null hides the link.
   *
   * The reporter is named on both queues (0129) but never linked: a name is
   * enough to weigh a grudge report, and a profile link turns the queue into a
   * way to go and find them.
   */
  authorBase?: string | null;
  /**
   * This reader may change an answer somebody has already given. Admins only:
   * 0128 made `resolve_moderation_flag` accept an answered flag so the platform
   * can overrule a club, and this dialog kept hiding the buttons on anything
   * that was not still open, so the capability existed and could not be
   * reached. A club sees the decision and no way to undo it, which is the
   * point of the admin having the final say.
   */
  canReopen?: boolean;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const [reason, setReason] = useState("");
  // Which of the two was pressed, so only that one spins. The board's check-in
  // buttons learned this the hard way: one busy flag across a row means either
  // everything spins or, as shipped, nothing does.
  const [pressed, setPressed] = useState<"keep" | "remove" | null>(null);

  useEffect(() => { if (flag) { setReason(""); setPressed(null); } }, [flag]);

  const answer = (action: "keep" | "remove") => {
    setPressed(action);
    onAnswer(action, reason);
  };

  const waiting = flag?.status === "open";
  // A withdrawn report is nobody's to answer, including an admin's.
  const answering = waiting || (canReopen && flag?.status !== "withdrawn");

  return (
    <Dialog open={flag !== null} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="sm" fullScreen={small}>
      <DialogTitle sx={{ fontSize: "1.2rem" }}>
        {flag ? `${targetLabel(flag.target_type)} by ${flag.author_name}` : "Report"}
        <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
          {flag ? [
            flag.club_name || "Not about a club",
            // "reported by Somebody" reads as a bug rather than as a rule.
            // The club is never told who, and a deleted account has no name
            // either, so both say the same true thing.
            flag.reporter_name === "Somebody"
              ? "reported by a member" : `reported by ${flag.reporter_name}`,
            shortDate(flag.created_at.slice(0, 10)),
          ].join(" · ") : ""}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack spacing={0.75}>
            <Label>Why it was reported</Label>
            <Typography variant="body2">
              {flag?.reason?.trim() || "No reason was given."}
            </Typography>
          </Stack>

          <Stack spacing={0.75}>
            <Label>What was said</Label>
            <Box sx={{ p: 2, borderRadius: 1.5, backgroundColor: tokens.surface,
                       border: `1px solid ${tokens.rule}` }}>
              {flag?.target_gone ? (
                <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                  This has been taken down, so there is nothing left to read.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {flag?.title ? (
                    <Typography sx={{ fontFamily: display, fontWeight: 700 }}>
                      {flag.title}
                    </Typography>
                  ) : null}
                  {/* Whitespace kept, so a wall of text reads as one. */}
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {flag?.body?.trim() || "There are no words on this one."}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>

          {flag && !waiting ? (
            <Stack spacing={0.75}>
              <Label>Already answered</Label>
              <Typography variant="body2">
                {flag.status === "actioned" ? "Taken down." : "Left as it is."}
                {flag.resolution ? ` ${flag.resolution}` : ""}
              </Typography>
            </Stack>
          ) : null}

          {answering ? (
            <>
              <TextField label="Note (optional)" value={reason} multiline minRows={2}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                helperText={waiting
                  ? "Kept on the record, so the next person knows why."
                  : "This replaces the answer above, and the person who reported it is told again."} />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
                sx={{ justifyContent: "flex-end", pb: 1 }}>
                <Button variant="text" onClick={onClose} disabled={busy}
                  sx={{ order: { xs: 3, sm: 0 } }}>
                  Close
                </Button>
                {/* `loading`, not a grey button. Rule 3 of the checklist: the
                    label holds still and a spinner takes the start slot, and a
                    working button is not a disabled one, so its colour is put
                    back over MUI's disabled grey. Answering is a real round
                    trip, and both buttons just went pale and nothing moved. */}
                <Button variant="outlined" disabled={busy}
                  loading={busy && pressed === "keep"} loadingPosition="start"
                  aria-label={busy && pressed === "keep" ? "Leaving it up" : undefined}
                  onClick={() => answer("keep")}
                  sx={busy && pressed === "keep"
                    ? { "&.Mui-disabled": { color: "primary.main",
                                            borderColor: "primary.main", opacity: 0.75 } }
                    : undefined}>
                  Leave it up
                </Button>
                <Button variant="contained" disabled={busy}
                  loading={busy && pressed === "remove"} loadingPosition="start"
                  aria-label={busy && pressed === "remove" ? "Taking it down" : undefined}
                  onClick={() => answer("remove")}
                  sx={{ backgroundColor: tokens.danger,
                        "&:hover": { backgroundColor: "#8E1E17" },
                        // White on danger while it works, or the label and the
                        // spinner both vanish into MUI's disabled grey.
                        ...(busy && pressed === "remove"
                          ? { "&.Mui-disabled": { backgroundColor: tokens.danger,
                                                  color: "#FFFFFF", opacity: 0.9 } }
                          : {}) }}>
                  Take it down
                </Button>
              </Stack>
            </>
          ) : (
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pb: 1 }}>
              <Button variant="text" onClick={onClose}>Close</Button>
            </Stack>
          )}

          {/* The way to the author, rather than a second set of buttons here
              that would duplicate what Accounts already does properly. */}
          {authorBase && flag?.author_id ? (
            <Box sx={{ pt: 1, borderTop: `1px solid ${tokens.rule}` }}>
              <LinkButton variant="text" size="small"
                href={`${authorBase}/${flag.author_id}`}>
                Open {flag.author_name}
              </LinkButton>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                      letterSpacing: "0.1em", color: tokens.inkMuted }}>
      {children}
    </Typography>
  );
}
