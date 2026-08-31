"use client";

import { useActionState, useEffect, useRef } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import { useFormStatus } from "react-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import { messageAction, type MessageState } from "@/app/account/messages/actions";
import { initialsOf } from "@/utils/format";
import { sinceLabel } from "@/utils/dates";
import { tokens, type Faction } from "@/lib/tokens";
import type { Conversation as Thread } from "@/types/message";

/** One conversation: fixed head, scrolling history, composer pinned below. */
export default function Conversation({
  conversation, faction,
}: {
  conversation: Thread;
  faction: Faction;
}) {
  const [state, submit] = useActionState<MessageState, FormData>(messageAction, {});
  useActionToast(state);
  const foot = useRef<HTMLDivElement>(null);
  const count = conversation.messages.length;

  // Newest at the bottom, so the bottom is where you start. Keyed to the count
  // rather than the array: a refresh that changed nothing should not yank the
  // view down while somebody is reading back through the thread.
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [count, conversation.personId]);

  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      <Stack direction="row" spacing={1.5}
        sx={{ px: { xs: 1.5, md: 2.5 }, py: 1.5, alignItems: "center", flexShrink: 0,
              borderBottom: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        {/* Only on a phone, where the rail is not on screen to go back to. */}
        <IconButton component={NextLink} href="/account/messages" aria-label="All messages"
          sx={{ display: { md: "none" }, ml: -0.5 }}>
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>

        <Box sx={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                   display: "grid", placeItems: "center",
                   backgroundColor: faction.soft, color: faction.deep }}>
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.85rem" }}>
            {initialsOf(conversation.personName)}
          </Typography>
        </Box>

        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography variant="h2" sx={{ fontSize: "1.05rem", lineHeight: 1.25,
                                         overflow: "hidden", textOverflow: "ellipsis",
                                         whiteSpace: "nowrap" }}>
            {conversation.personName}
          </Typography>
          <Typography component={NextLink} href={`/clubs/${conversation.clubSlug}`}
            sx={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.08em",
                  color: faction.deep, textDecoration: "none",
                  "&:hover": { textDecoration: "underline" } }}>
            {conversation.clubName.toUpperCase()}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto",
                 px: { xs: 1.5, md: 2.5 }, py: 2 }}>

        {count === 0 ? (
          <Stack spacing={1} sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="subtitle2">No messages yet</Typography>
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              Say hello. They will see it straight away.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.25}>
            {conversation.messages.map((message) => (
              <Stack key={message.id}
                sx={{ alignItems: message.isMine ? "flex-end" : "flex-start" }}>
                <Box
                  sx={{
                    maxWidth: "78%",
                    px: 1.75, py: 1.15,
                    borderRadius: 2,
                    // The tail corner marks who spoke without needing a name on
                    // every message.
                    borderBottomRightRadius: message.isMine ? 4 : 16,
                    borderBottomLeftRadius: message.isMine ? 16 : 4,
                    backgroundColor: message.isMine ? faction.base : tokens.surface,
                    color: message.isMine ? "#fff" : tokens.ink,
                    border: message.isMine ? "none" : `1px solid ${tokens.rule}`,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                    {message.content}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                                  letterSpacing: "0.06em", color: tokens.inkMuted, mt: 0.35 }}>
                  {(sinceLabel(message.createdAt) ?? "").toUpperCase()}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}

        <Box ref={foot} />
      </Box>

      {/* A real form, so useFormStatus drives the spinner and React clears the
          box only once the message has landed. Clearing on click disabled the
          button, which took the spinner with it. */}
      <Box component="form" action={submit}
        sx={{ flexShrink: 0, px: { xs: 1.5, md: 2.5 }, py: 1.5,
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        <input type="hidden" name="clubId" value={conversation.clubId} />
        <input type="hidden" name="personId" value={conversation.personId} />

        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
          <TextField
            name="content"
            placeholder={`Message ${conversation.personName.split(" ")[0]}`}
            aria-label="Message"
            multiline
            maxRows={5}
            fullWidth
            required
            size="small"
            slotProps={{ htmlInput: { maxLength: 4000 } }}
            sx={{ "& .MuiOutlinedInput-root": { backgroundColor: tokens.paper } }}
          />
          <SendButton faction={faction} />
        </Stack>
      </Box>
    </Stack>
  );
}

/**
 * Its own component so useFormStatus can read the enclosing form. A hook
 * called in the parent would see no form at all.
 */
function SendButton({ faction }: { faction: Faction }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="contained" loading={pending} aria-label="Send"
      sx={{ flexShrink: 0, minWidth: 0, px: 2, py: 1,
            backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }}>
      <SendIcon sx={{ fontSize: 19 }} />
    </Button>
  );
}
