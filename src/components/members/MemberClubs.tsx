import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ClubLogo from "@/components/clubs/ClubLogo";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { SharedClub } from "@/services/memberContext.service";

/**
 * The clubs this person belongs to that the reader can see.
 *
 * RLS already limits it to clubs they share, so this is "where we both play"
 * without having to say so.
 */
export default function MemberClubs({ clubs }: { clubs: SharedClub[] }) {
  if (!clubs.length) return null;

  return (
    <Stack spacing={1}>
      {clubs.map((club) => (
        <Stack key={club.slug} direction="row" spacing={1.75}
          sx={{ px: 2, py: 1.5, borderRadius: 2, alignItems: "center",
                border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
          <ClubLogo slug={club.slug} name={club.name} logoUrl={club.logoUrl}
            size={34} ring={tokens.rule} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <NextLink href={`/clubs/${club.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}>
              <Typography sx={{ fontFamily: display, fontWeight: 700,
                                "&:hover": { color: tokens.brand } }} noWrap>
                {club.name}
              </Typography>
            </NextLink>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                              letterSpacing: "0.06em", color: tokens.inkMuted }}>
              {club.joinedAt ? `JOINED ${(shortDate(club.joinedAt) ?? "").toUpperCase()}` : "MEMBER"}
              {club.years >= 1 ? ` · ${club.years} ${club.years === 1 ? "YEAR" : "YEARS"}` : ""}
            </Typography>
          </Box>

          {club.tierLabel ? (
            <Chip size="small" label={club.tierLabel}
              sx={{ bgcolor: tokens.brassSoft, color: "#5c4310", fontWeight: 700,
                    fontSize: "0.68rem", flexShrink: 0 }} />
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
