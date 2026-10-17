import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ScrollBox from "@/components/ui/ScrollBox";
import StatusChip from "@/components/ui/StatusChip";
import type { ClubFeaturedSlot } from "@/services/featured.service";
import { splitSlots } from "@/utils/featured-slots";
import { pricePence } from "@/utils/format";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * The slots this club holds, has held, and is waiting on.
 *
 * The client's words: *"they should see upcoming featured bookings, as well as
 * current live bookings with start/end date and cost ... and do not see past
 * bookings."* All three were in the database the whole time and no owner
 * screen read any of them: a club found out it was on the homepage by looking
 * at the homepage, and found out a slot had ended by 0155's email.
 *
 * Three named groups rather than one list with a chip per row, because the
 * three answer different questions: what is running, what is coming, and what
 * it cost last time.
 *
 * The admin's own note on a slot is deliberately not here. Its helper says
 * "who agreed it, or what it was for", so it is written by us for us, and a
 * club's billing page is not where an internal record goes.
 */
export default function FeaturedSlots({
  slots, today,
}: {
  slots: ClubFeaturedSlot[];
  /** A London day, like every other date on this page. */
  today: string;
}) {
  const { live, upcoming, past } = splitSlots(slots, today);

  if (slots.length === 0) {
    // One muted line, not an EmptyState: inside a panel that is mostly a form,
    // "you have not had one yet" is context rather than a screen of its own.
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        You have not held a featured slot yet. Ask below and we will find you a week.
      </Typography>
    );
  }

  const groups: [string, ClubFeaturedSlot[], boolean][] = [
    ["On the homepage now", live, true],
    ["Booked", upcoming, false],
    ["Finished", past, false],
  ];

  return (
    <Stack spacing={1.75}>
      {groups.filter(([, rows]) => rows.length > 0).map(([heading, rows, now]) => (
        <Stack key={heading} spacing={0.5}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                              letterSpacing: "0.08em", color: tokens.inkMuted }}>
              {heading.toUpperCase()}
            </Typography>
            {now ? <StatusChip label="Live" tone="kept" /> : null}
          </Stack>

          {/* Bounded, because a club a few years in has a long Finished list
              and this panel sits above the form somebody came here to use. */}
          <ScrollBox label={`${heading} featured slots`} cap={168}
            scrolls={rows.length > 4}>
            <Stack>
              {rows.map((slot) => (
                <Stack key={slot.id} direction="row" spacing={1.25}
                  sx={{ alignItems: "baseline", flexWrap: "wrap", py: 0.6,
                        borderBottom: `1px solid ${tokens.rule}`,
                        "&:last-of-type": { borderBottom: 0 } }} useFlexGap>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.8rem",
                                    fontWeight: now ? 700 : 500 }}>
                    {`${shortDate(slot.startsOn)} to ${shortDate(slot.endsOn)}`}
                  </Typography>
                  {/* A slot booked at nothing says nothing. "£0" reads as a
                      price somebody set rather than one nobody recorded. */}
                  {slot.pricePence > 0 ? (
                    <Typography sx={{ fontFamily: mono, fontSize: "0.74rem",
                                      color: tokens.brass }}>
                      {pricePence(slot.pricePence, slot.currency)}
                    </Typography>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </ScrollBox>
        </Stack>
      ))}
    </Stack>
  );
}
