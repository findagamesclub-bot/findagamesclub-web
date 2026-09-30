"use client";

import { useActionState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import MailOffIcon from "@mui/icons-material/Unsubscribe";
import { unsubscribeAction, type UnsubscribeState } from
  "@/app/unsubscribe/[token]/actions";
import { display, tokens } from "@/lib/tokens";

/**
 * One button, and what it stops.
 *
 * Named rather than generic: somebody who presses "unsubscribe" and cannot
 * tell whether it stopped this message or everything has been given a worse
 * deal than no button. The card says what will stop, and afterwards it says
 * what did.
 */
export default function UnsubscribePanel({
  token, label, detail, alreadyOff,
}: {
  token: string;
  label: string | null;
  detail: string | null;
  alreadyOff: boolean;
}) {
  const [state, submit, pending] = useActionState<UnsubscribeState, FormData>(
    unsubscribeAction, {});

  const stopped = state.done ?? (alreadyOff ? label : null);

  return (
    <Box sx={{
      border: `1px solid ${tokens.rule}`, borderRadius: 1,
      backgroundColor: tokens.paper, p: { xs: 3, md: 4 },
    }}>
      {!label ? (
        <Panel
          title="We do not recognise that link"
          body="It may have been replaced by a newer email, or copied incompletely. Open any recent email from us and use the link at the bottom, or change everything at once in your account."
        />
      ) : stopped ? (
        <Panel
          icon={<CheckIcon aria-hidden sx={{ fontSize: 30, color: tokens.brass }} />}
          title={`Emails about ${stopped.toLowerCase()} are off`}
          body="Your notification bell still keeps the record, so nothing is lost. You can turn emails back on whenever you like."
        />
      ) : (
        <form action={submit}>
          <input type="hidden" name="token" value={token} />
          <Panel
            icon={<MailOffIcon aria-hidden sx={{ fontSize: 30, color: tokens.brass }} />}
            title={`Stop emails about ${label.toLowerCase()}?`}
            body={detail ?? ""}
          />
          <Typography sx={{
            mt: 2, fontSize: "0.9rem", lineHeight: 1.6, color: tokens.inkMuted,
          }}>
            Nothing else changes. Your notification bell keeps every one of
            these, so you can still see what happened.
          </Typography>

          {state.error ? (
            <Typography role="alert" sx={{
              mt: 2, fontSize: "0.9rem", lineHeight: 1.6, color: tokens.danger,
            }}>
              {state.error}
            </Typography>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            loading={pending}
            loadingPosition="start"
            startIcon={<MailOffIcon />}
            sx={{ mt: 3 }}
          >
            Turn these emails off
          </Button>
        </form>
      )}

      <Typography sx={{ mt: 3, fontSize: "0.88rem", color: tokens.inkMuted }}>
        <Box component="a" href="/account/notifications" sx={{ color: "inherit" }}>
          Change all your email settings
        </Box>
      </Typography>
    </Box>
  );
}

function Panel({ icon, title, body }: {
  icon?: React.ReactNode; title: string; body: string;
}) {
  return (
    <Stack spacing={1.5}>
      {icon}
      <Typography component="h1" sx={{
        fontFamily: display, fontWeight: 700, fontSize: "1.45rem", lineHeight: 1.25,
      }}>
        {title}
      </Typography>
      {body ? (
        <Typography sx={{ fontSize: "1rem", lineHeight: 1.6, color: tokens.inkMuted }}>
          {body}
        </Typography>
      ) : null}
    </Stack>
  );
}
