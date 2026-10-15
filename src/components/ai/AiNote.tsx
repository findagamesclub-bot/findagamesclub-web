"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { tokens } from "@/lib/tokens";

/**
 * Why there is no button here.
 *
 * One treatment for both reasons, because it was written out twice already
 * (`AiPanel` and `SeasonCoach`) and two copies of a thing drift the first time
 * either is touched.
 *
 * Two icons, though, because they are two different facts and only one of them
 * is something the reader can do anything about. A padlock says "your tier
 * does not include this", which somebody can change by moving tier. The site
 * not having written coaching switched on is not a lock: nobody at the club
 * can unlock it and offering a padlock invites them to try. That one is an
 * ordinary note.
 */
export default function AiNote({
  children, kind = "locked",
}: {
  children: React.ReactNode;
  kind?: "locked" | "note";
}) {
  const Icon = kind === "locked" ? LockOutlinedIcon : InfoOutlinedIcon;
  return (
    <Stack direction="row" spacing={1.5}
      sx={{ alignItems: "flex-start", p: 2, borderRadius: 1.5,
            border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Icon aria-hidden sx={{ fontSize: 20, color: tokens.inkMuted, mt: 0.2 }} />
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {children}
      </Typography>
    </Stack>
  );
}
