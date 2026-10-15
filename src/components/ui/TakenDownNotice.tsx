import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LongText from "./LongText";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * An admin has taken this listing down, and here is what they said (0188).
 *
 * One component for a club and for an event, because the two notices answer
 * the same three questions in the same order: what has happened, why, and who
 * can undo it. Two of them would drift the first time either was touched, and
 * the client has asked for one look everywhere three times now.
 *
 * It leads the page, the way a called-off event leads with its reason. Whoever
 * is reading this can see something nobody else can, and the reason is the one
 * thing they opened it for.
 *
 * The reason goes through `LongText` because it is free text somebody typed
 * and has no length anybody controls.
 */
export default function TakenDownNotice({
  kind, reason, at, byName, canAct = false,
}: {
  kind: "club" | "event";
  reason: string;
  at: string | null;
  /** The admin who wrote it. Empty where the account has since gone. */
  byName: string;
  /** The reader is a site admin, so the sentence about asking one is wrong. */
  canAct?: boolean;
}) {
  const when = at ? shortDate(at.slice(0, 10)) : null;
  const stamp = [when ? `TAKEN DOWN ${when}` : "TAKEN DOWN",
    byName ? `BY ${byName}` : null].filter(Boolean).join(" · ").toUpperCase();

  return (
    <Alert severity="error" sx={{ mb: 3 }}>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {kind === "club"
            ? "A site admin has taken this listing out of the directory"
            : "A site admin has taken this event listing down"}
        </Typography>

        <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                          letterSpacing: "0.08em", color: tokens.inkMuted }}>
          {stamp}
        </Typography>

        {reason ? <LongText text={reason} lines={9} /> : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            No reason was recorded.
          </Typography>
        )}

        <Typography variant="body2">
          {kind === "club"
            ? "Nobody can find the club, join it or book a table. Your own team "
              + "can still open every page here, so you can put right whatever "
              + "this is about. "
            : "It is gone from the events list and nobody can book a new place. "
              + "Everybody who already booked keeps theirs, and you can still "
              + "edit the event. "}
          {canAct
            ? "Put it back from the admin list when it is settled."
            : "Only a site admin can put it back."}
        </Typography>
      </Stack>
    </Alert>
  );
}
