import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ClubLogo from "@/components/clubs/ClubLogo";
import { nightLabel } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { MemberContext } from "@/services/memberContext.service";

/**
 * Your record against this person, and the games behind it.
 *
 * Mutual rather than a copy of their whole history: "you have beaten Joe four
 * times" belongs to both of you, and Joe's results against everybody else are
 * his. That is also what makes it safe to show on somebody else's page.
 */
export default function MemberRecord({
  name, fullName, record, meetings, clubs,
}: {
  /** First name, for the sentence. */
  name: string;
  /** Full name, for the search this links into. */
  fullName: string;
  record: MemberContext["record"];
  meetings: MemberContext["meetings"];
  /** Shared clubs, for the way through to that club's whole table. */
  clubs: MemberContext["clubs"];
}) {
  if (!meetings.length) return null;

  const lead = record.won > record.lost;
  const behind = record.lost > record.won;
  const played = meetings.filter((game) => game.outcome);
  const coming = meetings.filter((game) => !game.played);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2}
        sx={{ px: 2.25, py: 2, borderRadius: 2, alignItems: "center",
              border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            YOUR RECORD
          </Typography>
          <Typography sx={{ fontFamily: display, fontWeight: 600 }}>
            {record.played
              ? lead ? `You are ahead of ${name}.`
                : behind ? `${name} is ahead of you.`
                : `You and ${name} are level.`
              : `No results recorded against ${name} yet.`}
          </Typography>
          {coming.length ? (
            <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
              {`${coming.length} more booked.`}
            </Typography>
          ) : null}
        </Box>

        <Typography sx={{ fontFamily: mono, fontSize: "1.6rem", fontWeight: 700,
                          flexShrink: 0,
                          color: lead ? "#1B5E20" : behind ? tokens.danger : tokens.ink }}>
          {`${record.won}-${record.drawn}-${record.lost}`}
        </Typography>
      </Stack>

      {played.length ? (
        <Box sx={{ borderRadius: 2, overflow: "hidden",
                   border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
          {played.slice(0, 6).map((game, i) => (
            <Stack key={game.id} direction="row" spacing={1.5}
              sx={{ px: 2, py: 1.25, alignItems: "center",
                    borderTop: i === 0 ? "none" : `1px solid ${tokens.rule}` }}>
              <ClubLogo slug={game.club.slug} name={game.club.name}
                logoUrl={game.club.logoUrl} size={28} ring={tokens.rule} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {game.title}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.62rem",
                                  color: tokens.inkMuted }} noWrap>
                  {nightLabel(game.date).toUpperCase()}
                  {game.myArmy ? ` · ${game.myArmy.toUpperCase()} V ${(game.theirArmy || "?").toUpperCase()}` : ""}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: mono, fontSize: "0.95rem", fontWeight: 700,
                                flexShrink: 0 }}>
                {`${game.myScore}–${game.theirScore}`}
              </Typography>
              <Chip size="small"
                label={game.outcome === "won" ? "W" : game.outcome === "lost" ? "L" : "D"}
                sx={{ width: 26, height: 22, fontWeight: 700, flexShrink: 0,
                      bgcolor: game.outcome === "won" ? "#E7F3E8"
                        : game.outcome === "lost" ? "#FBE9E7" : tokens.surface,
                      color: game.outcome === "won" ? "#1B5E20"
                        : game.outcome === "lost" ? tokens.danger : tokens.inkMuted }} />
            </Stack>
          ))}
        </Box>
      ) : null}

      {/* Back the way the reader came: their games, already narrowed to this
          person. Getting to a profile from a game was one click; getting to
          the games from a profile was none. */}
      <Stack direction="row" spacing={2.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        <NextLink href={`/account/games?q=${encodeURIComponent(fullName)}`}
          style={{ textDecoration: "none" }}>
          <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
            {`All your games with ${name}`}
          </Typography>
        </NextLink>

        {/* Legacy puts a View my rivals button on the member page; the table it
            opens is the club's, so the link is per club. One club is the
            common case, and naming it beats a bare "Rivalries". */}
        {clubs.map((club) => (
          <NextLink key={club.slug} href={`/clubs/${club.slug}/rivalries`}
            style={{ textDecoration: "none" }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              {clubs.length === 1
                ? "Rivalries at this club"
                : `Rivalries at ${club.name}`}
            </Typography>
          </NextLink>
        ))}
      </Stack>
    </Stack>
  );
}
