import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ClubLogo from "@/components/clubs/ClubLogo";
import LockIcon from "@mui/icons-material/Lock";
import ResultDialog from "./ResultDialog";
import { confirmationLabel, deploymentLabel } from "@/utils/result-meta";
import { nightLabel } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { MyGame } from "@/services/games.service";

const OUTCOME = {
  won: { label: "Won", tone: "#1B5E20", bg: "#E7F3E8" },
  lost: { label: "Lost", tone: tokens.danger, bg: "#FBE9E7" },
  drew: { label: "Drew", tone: tokens.inkMuted, bg: tokens.surface },
} as const;

/**
 * One game, told from the reader's side.
 *
 * The scoreline leads because it is the only thing anybody looks at twice.
 * A game that has happened with no result gets the prompt instead, which is
 * how the history fills itself in.
 */
export default function GameCard({ game }: { game: MyGame }) {
  const state = game.outcome ? OUTCOME[game.outcome] : null;
  const waiting = game.played && !game.outcome;

  const context = [
    game.mission,
    deploymentLabel(game.deployment),
    game.terrain,
  ].filter(Boolean) as string[];

  return (
    <Stack sx={{ height: "100%", borderRadius: 2, overflow: "hidden",
                 backgroundColor: tokens.paper,
                 border: `1px solid ${waiting ? tokens.brass : tokens.rule}` }}>
      <Stack direction="row" spacing={1.75}
        sx={{ px: 2.25, py: 1.75, alignItems: "center",
              borderBottom: `1px solid ${tokens.rule}` }}>
        <ClubLogo slug={game.club.slug} name={game.club.name}
          logoUrl={game.club.logoUrl} size={38} ring={tokens.rule} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: display, fontSize: "1rem", fontWeight: 700 }} noWrap>
            {game.title}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                            letterSpacing: "0.06em", color: tokens.inkMuted }} noWrap>
            {`${game.club.name.toUpperCase()} · ${nightLabel(game.date).toUpperCase()}`}
          </Typography>
        </Box>
        {state ? (
          <Chip size="small" label={state.label}
            sx={{ bgcolor: state.bg, color: state.tone, fontWeight: 700,
                  fontSize: "0.7rem", flexShrink: 0 }} />
        ) : null}
      </Stack>

      <Stack direction="row" spacing={1.5}
        sx={{ px: 2.25, py: 2, alignItems: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            YOU
          </Typography>
          <Typography noWrap sx={{ color: tokens.inkMuted, fontSize: "0.84rem" }}>
            {game.myArmy || "—"}
          </Typography>
        </Box>

        {game.outcome ? (
          <Typography sx={{ fontFamily: mono, fontSize: "1.4rem", fontWeight: 700,
                            flexShrink: 0, letterSpacing: "0.02em" }}>
            {`${game.myScore} – ${game.theirScore}`}
          </Typography>
        ) : (
          <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", color: tokens.inkMuted,
                            flexShrink: 0 }}>
            {game.played ? "NO RESULT" : "TO COME"}
          </Typography>
        )}

        <Box sx={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted }} noWrap>
            {game.opponentName.toUpperCase()}
          </Typography>
          <Typography noWrap sx={{ color: tokens.inkMuted, fontSize: "0.84rem" }}>
            {game.theirArmy || "—"}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1}
        sx={{ mt: "auto", px: 2.25, py: 1.25, alignItems: "center",
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        {game.opponentId ? (
          <NextLink href={`/members/${game.opponentId}`} style={{ textDecoration: "none" }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              Their profile
            </Typography>
          </NextLink>
        ) : (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Not a member here
          </Typography>
        )}
        {/* How the game was set up, on the card rather than only inside the
            dialog: it is the thing somebody scrolls their history looking for
            ("which mission did we play that time"). */}
        {context.length ? (
          <Typography variant="body2" noWrap
            sx={{ color: tokens.inkMuted, minWidth: 0, flexShrink: 1 }}>
            {context.join(" · ")}
          </Typography>
        ) : null}

        <Box sx={{ flex: 1 }} />

        {/* Only worth saying when it is not the ordinary case. A submitted
            result is every result, so a chip for it would be noise. */}
        {game.outcome && game.confirmation !== "submitted" ? (
          <Chip size="small"
            icon={game.locked ? <LockIcon sx={{ fontSize: 13 }} /> : undefined}
            label={confirmationLabel(game.confirmation)}
            sx={{ fontSize: "0.66rem", height: 22, flexShrink: 0,
                  backgroundColor: game.confirmation === "disputed"
                    ? "#FBE9E7" : tokens.brassSoft,
                  color: game.confirmation === "disputed" ? "#8a2f22" : "#5c4310",
                  "& .MuiChip-icon": { color: "inherit" } }} />
        ) : null}

        {game.played
          ? <ResultDialog game={game} canManageClub={game.canManageClub} />
          : null}
      </Stack>
    </Stack>
  );
}
