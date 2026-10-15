import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { clubIdentity } from "@/utils/club-identity";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

/**
 * Where this person stands, club by club.
 *
 * One row per CLUB, not one per attachment. Somebody can run a club and belong
 * to it, and that is one fact about one place: a team list above a membership
 * list would print Didcot twice and leave the reader to work out it was the
 * same club.
 *
 * Keyed by the club's own monogram and faction colour, the same pair the
 * directory, the admin lists and the moderation queue use, so an admin skims
 * this by the colour they already know. This is the one screen in the console
 * where a person's whole relationship to the site is on view, and that
 * relationship is a list of clubs: in a club directory, that IS the record.
 */

type ClubRow = {
  id: number;
  slug: string;
  name: string;
  city: string;
  clubStatus: string;
  teamRole: string;
  membershipStatus: string;
  tierLabel: string;
  joined: string | null;
  lifetime: number;
};

/** What a membership row means, in the words the rest of the site uses. */
const JOINED: Record<string, string> = {
  approved: "Member",
  pending: "Waiting to be approved",
  cancelled: "Left the club",
  declined: "Turned down",
};

export default function AccountClubs({
  clubs, failed = false,
}: {
  clubs: ClubRow[];
  /** The read did not answer, which is not the same as belonging to nothing. */
  failed?: boolean;
}) {
  if (failed) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        The clubs would not load. Nothing was read, so this is not somebody who
        belongs to nothing. Check the latest migrations have been run, then try
        again.
      </Typography>
    );
  }

  if (!clubs.length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        They do not run a club and have not joined one. Everything else on this
        page is still theirs.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {clubs.map((club) => {
        const { faction, monogram } = clubIdentity(club.slug, club.name);

        // What they are at this club, in one line. Ordered the way somebody
        // reads it: what they do here, then since when, then how much they
        // have earned by turning up.
        const standing = [
          club.membershipStatus ? JOINED[club.membershipStatus] ?? club.membershipStatus : "",
          club.tierLabel,
          club.joined ? `since ${shortDate(club.joined)}` : "",
          club.lifetime > 0 ? `${club.lifetime.toLocaleString("en-GB")} pts` : "",
        ].filter(Boolean).join(" · ");

        return (
          <NextLink key={club.id} href={`/clubs/${club.slug}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <Stack direction="row" spacing={1.5}
              sx={{ alignItems: "center", px: 2, py: 1.5, borderRadius: 1.5,
                    border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                    transition: "border-color 120ms ease",
                    "&:hover": { borderColor: faction.base } }}>
              <Box aria-hidden sx={{
                flexShrink: 0, width: 36, height: 36, borderRadius: 1.25,
                display: "grid", placeItems: "center",
                backgroundColor: faction.base, color: "#FFFFFF",
                fontFamily: mono, fontSize: "0.72rem", fontWeight: 700 }}>
                {monogram}
              </Box>

              <Stack spacing={0.3} sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={0.75}
                  sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                  <Typography sx={{ fontFamily: display, fontWeight: 700,
                                    fontSize: "0.95rem", minWidth: 0 }}>
                    {club.name}
                  </Typography>
                  {/* What they RUN, in a chip, because it is the thing that
                      changes what this person can do rather than a detail of
                      where they play. A member gets no chip: the line
                      underneath already says so. */}
                  {club.teamRole ? (
                    <Chip size="small" label={club.teamRole}
                      sx={{ height: 20, fontSize: "0.62rem", fontFamily: mono,
                            fontWeight: 700, textTransform: "uppercase",
                            color: "#fff", bgcolor: faction.base }} />
                  ) : null}
                  {/* And whether the club is even in the directory, because an
                      owner of a suspended club is a different conversation. */}
                  {club.clubStatus !== "active" ? (
                    <Chip size="small" label={club.clubStatus}
                      sx={{ height: 20, fontSize: "0.62rem", fontFamily: mono,
                            color: "#fff", bgcolor: tokens.inkMuted }} />
                  ) : null}
                </Stack>
                <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                  color: tokens.inkMuted, minWidth: 0 }}>
                  {[club.city, standing].filter(Boolean).join(" · ")}
                </Typography>
              </Stack>

              <ChevronRightIcon sx={{ color: tokens.inkMuted, flexShrink: 0 }} />
            </Stack>
          </NextLink>
        );
      })}
    </Stack>
  );
}
