import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import OwnerTaskRow from "./OwnerTaskRow";
import { matGrid, tokens } from "@/lib/tokens";
import { clubIdentity } from "@/utils/club-identity";
import { FROM_MY_CLUBS } from "@/utils/back-link";
import type { OwnerClub } from "@/services/ownerInbox.service";

/**
 * One club a person runs, and what it is waiting on them for.
 *
 * The head takes the club's colour so a grid of them reads as a shelf of
 * distinct clubs rather than a table with a colour column. A club with nothing
 * outstanding keeps its card — an owner wants to see that all three are clear,
 * not have two of them disappear.
 */
/**
 * How many rows of detail a card shows before it stops.
 *
 * A club with fifty people waiting would otherwise draw a fifty-row card and
 * push every other club off the screen. Three is enough to see who has waited
 * longest; the counts on the links below carry the rest.
 */
const SHOW_TASKS = 3;

export default function OwnerClubCard({ club }: { club: OwnerClub }) {
  const { faction, monogram } = clubIdentity(club.slug, club.name);
  const waiting = club.tasks.length;
  const shown = club.tasks.slice(0, SHOW_TASKS);
  const countOf = (kind: OwnerClub["tasks"][number]["kind"]) =>
    club.tasks.filter((t) => t.kind === kind).length;

  return (
    <Stack
      sx={{
        border: `1px solid ${waiting ? faction.base : tokens.rule}`,
        borderRadius: 1.5,
        overflow: "hidden",
        backgroundColor: tokens.paper,
        height: "100%",
        transition: "box-shadow 160ms ease",
        "&:hover": { boxShadow: "0 2px 14px rgba(16,27,45,0.08)" },
      }}
    >
      <NextLink href={`/clubs/${club.slug}`} style={{ textDecoration: "none" }}>
        <Box
          sx={{
            position: "relative", overflow: "hidden",
            px: 2, py: 1.75,
            backgroundImage: `linear-gradient(135deg, ${faction.deep} 0%, ${faction.base} 100%)`,
          }}
        >
          <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: matGrid(0.06) }} />

          <Stack direction="row" spacing={1.75}
            sx={{ position: "relative", alignItems: "center" }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1, flexShrink: 0,
                       display: "grid", placeItems: "center",
                       border: "1px solid rgba(255,255,255,0.35)",
                       backgroundColor: "rgba(255,255,255,0.14)" }}>
              <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 800,
                                fontSize: "0.85rem", color: "#fff" }}>
                {monogram}
              </Typography>
            </Box>

            <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h3"
                sx={{ fontSize: "1.05rem", lineHeight: 1.25, color: "#fff",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {club.name}
              </Typography>
              {club.city ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                                  letterSpacing: "0.1em", color: "rgba(255,255,255,0.74)" }}>
                  {club.city.toUpperCase()}
                </Typography>
              ) : null}
            </Stack>

            {waiting ? (
              <Box sx={{ minWidth: 26, height: 26, px: 0.75, borderRadius: 999, flexShrink: 0,
                         display: "grid", placeItems: "center",
                         backgroundColor: tokens.brassOnDark }}>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                  fontSize: "0.78rem", color: "#2A1D06", lineHeight: 1 }}>
                  {waiting}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        </Box>
      </NextLink>

      {waiting ? (
        <Stack>
          {shown.map((task, i) => (
            <OwnerTaskRow key={`${task.kind}-${task.id}`} task={task}
              faction={faction} first={i === 0} />
          ))}
          {waiting > SHOW_TASKS ? (
            <Typography variant="body2"
              sx={{ px: 2, py: 1.25, color: tokens.inkMuted,
                    borderTop: `1px solid ${tokens.rule}` }}>
              {waiting - SHOW_TASKS} more waiting. Counts are on the links below.
            </Typography>
          ) : null}
        </Stack>
      ) : (
        <Stack direction="row" spacing={1.25}
          sx={{ px: 2, py: 2.25, alignItems: "center", flex: 1 }}>
          <CheckCircleIcon sx={{ fontSize: 17, color: tokens.positive, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Nothing waiting.
          </Typography>
        </Stack>
      )}

      {/* No loyalty link: each member's standing and their full ledger live on
          their own card in the roster, which is where an owner is when the
          question comes up. */}
      <Stack direction="row" spacing={0.5} useFlexGap
        sx={{ mt: "auto", px: 1.25, py: 1.25, flexWrap: "wrap",
              borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
        <CardLink href={`/clubs/${club.slug}/members${FROM_MY_CLUBS}`} faction={faction}
          lead count={countOf("join")}>
          {club.memberCount} {club.memberCount === 1 ? "member" : "members"}
        </CardLink>
        {club.runs.events ? (
          <CardLink href={`/clubs/${club.slug}/events${FROM_MY_CLUBS}`} faction={faction}>Events</CardLink>
        ) : null}
        {club.runs.board ? (
          <CardLink href={`/clubs/${club.slug}/board${FROM_MY_CLUBS}`} faction={faction}>Board</CardLink>
        ) : null}
        {club.runs.kit ? (
          <CardLink href={`/clubs/${club.slug}/shop${FROM_MY_CLUBS}`} faction={faction}
            count={countOf("order")}>Kit</CardLink>
        ) : null}
        {club.runs.coaching ? (
          <CardLink href={`/clubs/${club.slug}/coaching${FROM_MY_CLUBS}`} faction={faction}
            count={countOf("coaching")}>Coaching</CardLink>
        ) : null}
      </Stack>
    </Stack>
  );
}

/**
 * One way out of the card, with what is waiting behind it.
 *
 * The count is what makes this scale: an owner does not need fifty rows to
 * know fifty people are waiting, they need the number and a way in.
 */
function CardLink({ href, faction, lead, count = 0, children }: {
  href: string;
  faction: ReturnType<typeof clubIdentity>["faction"];
  lead?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <NextLink href={href} style={{ textDecoration: "none" }}>
      <Stack direction="row" spacing={0.6}
        sx={{
          alignItems: "center",
          px: 1.1, py: 0.55, borderRadius: 1,
          fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.06em",
          fontWeight: lead ? 700 : 500,
          color: lead ? faction.deep : tokens.inkMuted,
          backgroundColor: lead ? faction.soft : "transparent",
          "&:hover": { backgroundColor: faction.soft, color: faction.deep },
        }}
      >
        <Box component="span" sx={{ textTransform: "uppercase" }}>{children}</Box>
        {count ? (
          <Box component="span"
            aria-label={`${count} waiting`}
            sx={{ minWidth: 16, height: 16, px: 0.4, borderRadius: 999,
                  display: "inline-grid", placeItems: "center",
                  fontSize: "0.6rem", fontWeight: 700, lineHeight: 1,
                  backgroundColor: tokens.brass, color: "#FFFFFF" }}>
            {count}
          </Box>
        ) : null}
      </Stack>
    </NextLink>
  );
}
