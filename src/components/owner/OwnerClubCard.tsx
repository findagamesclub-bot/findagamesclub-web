import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { sinceLabel } from "@/utils/dates";
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
export default function OwnerClubCard({ club }: { club: OwnerClub }) {
  const { faction, monogram } = clubIdentity(club.slug, club.name);
  const waiting = club.tasks.length;
  // The one that has been waiting longest, which is the fact an owner acts on.
  const oldest = club.tasks
    .map((task) => task.at)
    .filter(Boolean)
    .sort()[0] ?? null;
  // Somebody waiting on a decision, as opposed to money the owner has yet to
  // mark off. Only the first kind earns red.
  const decisions = club.tasks.filter(
    (task) => task.kind === "join" || task.kind === "tier",
  ).length;
  const countOf = (kind: OwnerClub["tasks"][number]["kind"]) =>
    club.tasks.filter((t) => t.kind === kind).length;

  return (
    <Stack
      sx={{
        border: `1px solid ${waiting ? faction.base : tokens.rule}`,
        borderRadius: 1.5,
        overflow: "hidden",
        backgroundColor: tokens.paper,
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

            {/* Red on the club's own colour, so a shelf of cards can be read
                for "which of these needs me" before any of them is read for
                what it says. */}
            {waiting ? (
              <Box aria-label={`${waiting} waiting`}
                sx={{ minWidth: 26, height: 26, px: 0.75, borderRadius: 999, flexShrink: 0,
                      display: "grid", placeItems: "center",
                      backgroundColor: decisions ? "#fff" : "rgba(255,255,255,0.16)",
                      border: decisions ? `2px solid ${tokens.danger}` : "none" }}>
                <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700,
                                  fontSize: "0.78rem", lineHeight: 1,
                                  color: decisions ? tokens.danger : "#fff" }}>
                  {waiting}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        </Box>
      </NextLink>

      {/* One line, whether nothing is waiting or fifty things are.
          Listing the first three made a busy club three times the height of a
          clear one, and a grid of cards that each pick their own height is
          harder to read than the list it replaced. Which sections need the
          owner is on the links below; who exactly is on the section page. */}
      {waiting ? (
        <Stack direction="row" spacing={1.25}
          sx={{ px: 2, py: 1.5, alignItems: "center" }}>
          <ErrorOutlineIcon sx={{ fontSize: 17, flexShrink: 0,
                                  color: decisions ? tokens.danger : tokens.brass }} />
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>
              {waiting === 1 ? "One thing" : `${waiting} things`}
            </Box>
            {oldest ? ` waiting, longest ${sinceLabel(oldest)}.` : " waiting."}
          </Typography>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1.25}
          sx={{ px: 2, py: 1.5, alignItems: "center" }}>
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
          lead urgent count={countOf("join") + countOf("tier")}>
          {club.memberCount} {club.memberCount === 1 ? "member" : "members"}
        </CardLink>
        {/* Money owed is the club's own view of its roster, so it sits next to
            the member count rather than inside it. */}
        <CardLink href={`/clubs/${club.slug}/members/renewals${FROM_MY_CLUBS}`} faction={faction}
          urgent count={club.membershipsOwing}>
          Memberships
        </CardLink>
        {/* Tables booked from today on. Deliberately not `urgent`: a booking
            asks nothing of the club, so it never turns the count red or adds to
            "things waiting". It is here because an owner wants to know at a
            glance whether anybody is turning up. */}
        {club.upcomingTables ? (
          <CardLink href={`/clubs/${club.slug}/bookings${FROM_MY_CLUBS}`} faction={faction}>
            {club.upcomingTables} {club.upcomingTables === 1 ? "table" : "tables"}
          </CardLink>
        ) : null}
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
        {/* Always shown, unlike the others: a club with no competitions has no
            public page for them, so this is the only way in to set the first
            one up. */}
        <CardLink href={`/clubs/${club.slug}/competitions/manage${FROM_MY_CLUBS}`}
          faction={faction}>
          Competitions
        </CardLink>
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
function CardLink({ href, faction, lead, count = 0, urgent = false, children }: {
  href: string;
  faction: ReturnType<typeof clubIdentity>["faction"];
  lead?: boolean;
  count?: number;
  /** Somebody is waiting on a decision, rather than on the owner's paperwork. */
  urgent?: boolean;
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
            sx={{
              minWidth: 16, height: 16, px: 0.4, borderRadius: 999,
              display: "inline-grid", placeItems: "center",
              fontSize: "0.6rem", fontWeight: 700, lineHeight: 1,
              backgroundColor: urgent ? tokens.danger : tokens.brass,
              color: "#FFFFFF",
              ...(urgent ? {
                "@keyframes ownerPing": {
                  "0%": { boxShadow: "0 0 0 0 rgba(179,38,30,0.45)" },
                  "70%": { boxShadow: "0 0 0 5px rgba(179,38,30,0)" },
                  "100%": { boxShadow: "0 0 0 0 rgba(179,38,30,0)" },
                },
                // globals.css already stops this for anyone who asks for less
                // motion; that keeps the mark, just still.
                animation: "ownerPing 2.4s ease-out infinite",
              } : {}),
            }}>
            {count}
          </Box>
        ) : null}
      </Stack>
    </NextLink>
  );
}
