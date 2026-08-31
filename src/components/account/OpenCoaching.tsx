import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ClubLogo from "@/components/clubs/ClubLogo";
import { nightLabel } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { OpenSlot } from "@/services/myActivity.service";

/**
 * Coaching going at the member's own clubs.
 *
 * A strip above their bookings rather than a page of its own: it is a prompt,
 * not a directory, and it should disappear the moment there is nothing free.
 * Scrolls sideways so however many clubs somebody is in, this stays one band
 * and never pushes their own bookings off the screen.
 */
export default function OpenCoaching({ slots }: { slots: OpenSlot[] }) {
  if (!slots.length) return null;

  return (
    <Box sx={{ borderRadius: 2, overflow: "hidden",
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      <Stack direction="row" spacing={1.25}
        sx={{ px: 2.25, py: 1.5, alignItems: "baseline",
              borderBottom: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.12em", color: tokens.inkMuted, flex: 1 }}>
          PLACES GOING AT YOUR CLUBS
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.7rem", color: tokens.inkMuted }}>
          {slots.length}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5}
        sx={{ p: 2, overflowX: "auto",
              // Cards keep their width rather than squeezing to fit.
              "& > *": { flexShrink: 0 } }}>
        {slots.map((slot) => (
          <NextLink key={slot.id} href={`/clubs/${slot.club.slug}/coaching`}
            style={{ textDecoration: "none", color: "inherit" }}>
            <Stack spacing={1.25}
              sx={{ width: 250, height: "100%", p: 1.75, borderRadius: 2,
                    border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                    "&:hover": { borderColor: tokens.brass } }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                <ClubLogo slug={slot.club.slug} name={slot.club.name}
                  logoUrl={slot.club.logoUrl} size={30} ring={tokens.rule} />
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", flex: 1,
                                  letterSpacing: "0.06em", color: tokens.inkMuted }} noWrap>
                  {slot.club.name.toUpperCase()}
                </Typography>
                <Chip size="small" label={slot.kind}
                  sx={{ height: 19, fontFamily: mono, fontSize: "0.6rem",
                        bgcolor: tokens.surface }} />
              </Stack>

              <Box>
                <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "0.98rem" }}
                  noWrap>
                  {slot.title}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
                  {nightLabel(slot.date)}
                  {slot.startTime ? ` · ${slot.startTime}` : ""}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}
                sx={{ alignItems: "baseline", justifyContent: "space-between", mt: "auto" }}>
                <Typography sx={{ fontFamily: mono, fontSize: "0.85rem", fontWeight: 700 }}>
                  {slot.price ?? "Free"}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                    color: slot.placesLeft <= 2 ? tokens.danger : tokens.inkMuted,
                                    fontWeight: slot.placesLeft <= 2 ? 700 : 400 }}>
                    {slot.placesLeft === 1 ? "1 LEFT" : `${slot.placesLeft} LEFT`}
                  </Typography>
                  <ArrowForwardIcon sx={{ fontSize: 14, color: tokens.brand }} />
                </Stack>
              </Stack>
            </Stack>
          </NextLink>
        ))}
      </Stack>
    </Box>
  );
}
