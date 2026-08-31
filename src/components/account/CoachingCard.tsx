import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ClubLogo from "@/components/clubs/ClubLogo";
import { nightLabel } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { MyCoaching } from "@/services/myActivity.service";

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 600,
                        color: tone ?? tokens.ink }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * One coaching session, in a grid.
 *
 * The same three-fact shape as a membership card, so the account reads as one
 * place: when, how long, and where the money stands.
 */
export default function CoachingCard({ session }: { session: MyCoaching }) {
  const done = session.past || session.cancelled;
  const owing = !done && !session.paid;

  const money = session.cancelled
    ? { value: "Cancelled", tone: tokens.inkMuted }
    : session.paid
      ? { value: session.price ? `${session.price} paid` : "Paid", tone: "#1B5E20" }
      : session.past
        ? { value: "Not recorded", tone: tokens.inkMuted }
        : { value: session.price ? `${session.price} to pay` : "Due", tone: "#5c4310" };

  return (
    <Stack sx={{ height: "100%", borderRadius: 2, overflow: "hidden",
                 backgroundColor: tokens.paper, opacity: done ? 0.74 : 1,
                 border: `1px solid ${owing ? tokens.brass : tokens.rule}` }}>
      <Stack direction="row" spacing={1.75}
        sx={{ px: 2.25, py: 2, alignItems: "center",
              borderBottom: `1px solid ${tokens.rule}` }}>
        <ClubLogo slug={session.club.slug} name={session.club.name}
          logoUrl={session.club.logoUrl} size={42} ring={tokens.rule} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: display, fontSize: "1.05rem", fontWeight: 700 }}
            noWrap>
            {session.title}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted }} noWrap>
            {session.club.name.toUpperCase()}
          </Typography>
        </Box>

        <Chip size="small" label={session.kind}
          sx={{ height: 22, fontFamily: mono, fontSize: "0.66rem", flexShrink: 0,
                bgcolor: tokens.surface }} />
      </Stack>

      <Box sx={{ px: 2.25, py: 1.75, display: "grid", gap: 2,
                 gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <Fact label="WHEN" value={nightLabel(session.date)} />
        <Fact label="TIME"
          value={session.startTime && session.endTime
            ? `${session.startTime}–${session.endTime}`
            : session.startTime ?? "—"} />
        <Fact label="PAYMENT" value={money.value} tone={money.tone} />
      </Box>

      {session.description ? (
        <Typography variant="body2"
          sx={{ px: 2.25, pb: 2, color: tokens.inkMuted,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {session.description}
        </Typography>
      ) : null}

      <Box sx={{ mt: "auto", px: 2.25, py: 1.5, borderTop: `1px solid ${tokens.rule}`,
                 backgroundColor: tokens.surface }}>
        <NextLink href={`/clubs/${session.club.slug}/coaching`}
          style={{ textDecoration: "none" }}>
          <Button size="small" variant="text" sx={{ minWidth: 0, px: 0.5 }}>
            {done ? "Club coaching" : "Manage this booking"}
          </Button>
        </NextLink>
      </Box>
    </Stack>
  );
}
