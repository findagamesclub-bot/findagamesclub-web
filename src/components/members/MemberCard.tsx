import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import MetalPlate from "@/components/ui/MetalPlate";
import MemberLoyaltyButton from "@/components/loyalty/MemberLoyaltyButton";
import type { LoyaltyEntry } from "@/types/loyalty";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import TagChip from "./TagChip";
import { tokens, type Faction } from "@/lib/tokens";
import { monthYear } from "@/utils/dates";
import type { ClubMember } from "@/types/membership";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/**
 * One member, as a datasheet.
 *
 * A club roster in this hobby is an order of battle, so the card borrows the
 * shape of a unit entry: identity at the top, a rule, then what they field
 * along the foot. The club's colour lives in the avatar ring and on hover —
 * a coloured bar down the left edge was read as generic decoration.
 */
export default function MemberCard({
  member, faction, action, tierLabel, loyalty,
}: {
  member: ClubMember;
  faction: Faction;
  action?: React.ReactNode;
  tierLabel?: string | null;
  /**
   * Their standing at this club. On the roster because an owner managing ten
   * members should not have to hold a second page in their head to see who is
   * close to a reward.
   */
  loyalty?: {
    tier: string; tone: string; lifetime: number; available: number;
    toNext: number | null; nextTier: string | null; progress: number;
    entries: LoyaltyEntry[];
  } | null;
}) {
  const since = monthYear(member.joinedAt);


  return (
    <Box
      sx={{
        // A member the club owes an answer to is marked on the card as well
        // as listed in the queue above: an owner scrolling the roster should
        // not have to remember which names were in the queue.
        border: `1px solid ${member.requestedTierKey ? tokens.danger : tokens.rule}`,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: tokens.paper,
        transition: "border-color 120ms ease",
        "&:hover": { borderColor: member.requestedTierKey ? tokens.danger : faction.base },
      }}
    >
      {member.requestedTierKey ? (
        <Stack direction="row" spacing={0.75}
          sx={{ px: 2.25, py: 0.875, alignItems: "center",
                backgroundColor: tokens.danger, color: "#fff" }}>
          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
          <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                            fontWeight: 700, letterSpacing: "0.1em" }}>
            WANTS A TIER CHANGE
          </Typography>
        </Stack>
      ) : null}

      <Stack spacing={1.5} sx={{ p: 2.25, minWidth: 0 }}>
        <Stack direction="row" spacing={1.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <Avatar
            sx={{
              bgcolor: faction.soft, color: faction.deep,
              width: 52, height: 52, flexShrink: 0,
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem",
              border: `1.5px solid ${faction.base}`,
            }}
          >
            {initials(member.fullName)}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <NextLink href={`/members/${member.profileId}`} style={{ color: "inherit", textDecoration: "none" }}>
              <Typography variant="subtitle1" noWrap sx={{ "&:hover": { color: faction.base } }}>
                {member.fullName}
              </Typography>
            </NextLink>

            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
              {since ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                  letterSpacing: "0.06em", color: tokens.inkMuted }}>
                  SINCE {since.toUpperCase()}
                </Typography>
              ) : null}
              {member.tenureYears >= 1 ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                  letterSpacing: "0.06em", color: tokens.brass, fontWeight: 600 }}>
                  {member.tenureYears} YR{member.tenureYears > 1 ? "S" : ""}
                </Typography>
              ) : null}
              {tierLabel ? (
                <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem",
                                  letterSpacing: "0.06em", color: faction.deep, fontWeight: 600 }}>
                  {tierLabel.toUpperCase()}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Stack>

        {loyalty ? (
          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "center", pt: 1.25, borderTop: `1px solid ${tokens.rule}`,
                  flexWrap: "wrap", rowGap: 0.5 }}>
            <MetalPlate label={loyalty.tier} tone={loyalty.tone} size="small" />
            <Stack direction="row" spacing={2}
              sx={{ alignItems: "baseline", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
              <Figure value={loyalty.lifetime} label="all time" />
              <Figure value={loyalty.available} label="to spend" emphasis />
            </Stack>
            <MemberLoyaltyButton
              name={member.fullName}
              tier={loyalty.tier}
              tone={loyalty.tone}
              lifetime={loyalty.lifetime}
              available={loyalty.available}
              toNext={loyalty.toNext}
              nextTier={loyalty.nextTier}
              progress={loyalty.progress}
              entries={loyalty.entries}
            />
          </Stack>
        ) : null}

        {/* The foot of a datasheet lists what the unit brings. Here that is
            what the person turns up to play, and what they bring to play it
            with. Kept apart because the filters above these cards keep them
            apart: somebody who has just filtered by army could not tell which
            chip had matched when the two were run together under "PLAYS". */}
        <Box sx={{ borderTop: `1px solid ${tokens.rule}`, pt: 1.25 }}>
          {member.games.length || member.armies.length ? (
            <Stack spacing={1}>
              {member.games.length ? (
                <TagGroup label="PLAYS" tags={member.games} faction={faction} kind="game" />
              ) : null}
              {member.armies.length ? (
                <TagGroup label="ARMIES" tags={member.armies} faction={faction} kind="army" />
              ) : null}
            </Stack>
          ) : (
            <>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                                letterSpacing: "0.1em", color: tokens.inkMuted, mb: 0.75 }}>
                PLAYS
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
                Nothing listed yet.
              </Typography>
            </>
          )}
        </Box>

        {action}
      </Stack>
    </Box>
  );
}

function Figure({ value, label, emphasis }: {
  value: number; label: string; emphasis?: boolean;
}) {
  return (
    <Stack direction="row" spacing={0.6} sx={{ alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.95rem", fontWeight: 700,
                        lineHeight: 1, color: emphasis ? tokens.brass : tokens.ink }}>
        {value.toLocaleString("en-GB")}
      </Typography>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                        letterSpacing: "0.08em", color: tokens.inkMuted }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
  );
}

function TagGroup({ label, tags, faction, kind }: {
  label: string; tags: string[]; faction: Faction; kind: "game" | "army";
}) {
  return (
    <Box>
      <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted, mb: 0.75 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
        {tags.map((tag) => (
          <TagChip key={tag} label={tag} faction={faction} kind={kind} />
        ))}
      </Stack>
    </Box>
  );
}
