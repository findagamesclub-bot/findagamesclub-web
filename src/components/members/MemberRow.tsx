import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { tokens, type Faction } from "@/lib/tokens";
import { initials } from "@/utils/initials";
import TagChip from "./TagChip";
import type { ClubMember } from "@/types/membership";

/** One person on the roster. Games and armies come from their own profile. */
export default function MemberRow({
  member, faction, action,
}: { member: ClubMember; faction: Faction; action?: React.ReactNode }) {
  // One line, because a row has no space for two labelled groups. Games are
  // filled and armies outlined, so the two can still be told apart.
  const tags = [
    ...member.games.slice(0, 3).map((label) => ({ label, kind: "game" as const })),
    ...member.armies.slice(0, 2).map((label) => ({ label, kind: "army" as const })),
  ];

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{
        py: 2,
        borderTop: `1px solid ${tokens.rule}`,
        alignItems: { xs: "flex-start", sm: "center" },
      }}
    >
      <Avatar sx={{ bgcolor: faction.base, width: 46, height: 46, fontFamily: "var(--font-display)", fontWeight: 700 }}>
        {initials(member.fullName)}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <NextLink href={`/members/${member.profileId}`} style={{ color: "inherit", textDecoration: "none" }}>
            <Typography variant="subtitle1" sx={{ "&:hover": { color: faction.base } }}>
              {member.fullName}
            </Typography>
          </NextLink>
          {member.tenureYears >= 1 ? (
            <Chip
              size="small"
              label={`${member.tenureYears} yr${member.tenureYears > 1 ? "s" : ""}`}
              sx={{ bgcolor: tokens.brassSoft, color: "#5c4310", fontFamily: "var(--font-mono)" }}
            />
          ) : null}
        </Stack>

        {tags.length ? (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", mt: 0.5 }} useFlexGap>
            {tags.map((t) => (
              <TagChip key={t.label} label={t.label} faction={faction} kind={t.kind} />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">No games listed yet.</Typography>
        )}
      </Box>

      {action}
    </Stack>
  );
}
