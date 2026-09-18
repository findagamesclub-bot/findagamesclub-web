import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/LockOutlined";
import { mono, tokens } from "@/lib/tokens";

/**
 * A section somebody cannot open yet, named rather than hidden.
 *
 * The same call this codebase already made for a blocked ticket: legacy hides
 * it, which leaves somebody with no way to learn the thing exists. A member
 * deciding whether to book should be able to see that ticket holders get the
 * timings and the parking, and a club testing its own event should be able to
 * tell "gated" from "broken".
 *
 * Deliberately says what is behind the lock and never a word of it.
 */
export default function LockedNote({
  title, body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Stack direction="row" spacing={1.75}
      sx={{ p: 2.25, borderRadius: 1.5, alignItems: "flex-start",
            backgroundColor: tokens.surface, border: `1px solid ${tokens.rule}` }}>
      <LockIcon sx={{ fontSize: 18, color: tokens.inkMuted, flexShrink: 0, mt: 0.25 }} />
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {title.toUpperCase()}
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.ink }}>{body}</Typography>
      </Stack>
    </Stack>
  );
}
