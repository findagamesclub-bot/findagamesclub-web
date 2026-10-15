import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import LongText from "@/components/ui/LongText";
import { formatMemberCode } from "@/utils/member-code";
import { shortDate } from "@/utils/dates";
import { mono, tokens } from "@/lib/tokens";

/**
 * Everything the person themselves typed, and nothing summarised away.
 *
 * The client's words: "all data we hold on them for their profile". So every
 * field of it, including the empty ones: an admin answering "what do you have
 * on me" needs the answer to be the whole answer, and a field left off this
 * screen is a field nobody can audit.
 *
 * Read-only rows in the same shape `SubmissionDetails` uses, deliberately.
 * Those are the console's two "read one record and decide about it" screens,
 * and an admin should not have to learn a second way of reading a record.
 */

type Profile = {
  bio: string;
  postcode: string;
  travelMiles: number | null;
  ageGroups: string[];
  availability: string[];
  games: string[];
  armies: string[];
  playStyle: string[];
  links: { label: string; url: string }[];
  memberCode: string;
  updatedAt: string | null;
};

export default function AccountProfile({ profile }: { profile: Profile }) {
  const list = (values: string[]) => values.join(", ");

  return (
    <Stack spacing={1.25}>
      {/* Hyphenated the same way the member's own page prints it. The column
          holds eight characters and `formatMemberCode` is the one place that
          decides how a person reads one aloud; two spellings of one code is
          how somebody reads it out wrong over the phone. */}
      <Row label="Member code"
        value={profile.memberCode ? formatMemberCode(profile.memberCode) : ""} mono />
      <Row label="About them" value={profile.bio} long />
      <Row label="Home postcode" value={profile.postcode} mono />
      <Row label="Will travel"
        value={profile.travelMiles ? `${profile.travelMiles} miles` : ""} />
      <Row label="Age group" value={list(profile.ageGroups)} />
      <Row label="Free to play" value={list(profile.availability)} />
      <Row label="Games" value={list(profile.games)} />
      <Row label="Armies" value={list(profile.armies)} />
      <Row label="How they play" value={list(profile.playStyle)} />
      <Row label="Elsewhere"
        value={profile.links.map((l) => `${l.label}: ${l.url}`).join(", ")} />
      <Row label="Last edited"
        value={profile.updatedAt
          ? shortDate(profile.updatedAt.slice(0, 10)) ?? "" : ""} />

      {/* Said out loud, because it is the one field here that is not on their
          public profile and the one somebody would be surprised we hold. It is
          how the directory works out which clubs are near them. */}
      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted,
                        pt: 0.5 }}>
        Their postcode is only used to work out which clubs are near them. It is
        never shown on their profile or to a club.
      </Typography>
    </Stack>
  );
}

function Row({
  label, value, long = false, mono: isMono = false,
}: {
  label: string;
  value: string;
  /** Free text somebody typed, which has no length anybody controls. */
  long?: boolean;
  /** A code or a postcode: read character by character, so set as data. */
  mono?: boolean;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}
      sx={{ alignItems: { sm: "baseline" } }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                        letterSpacing: "0.08em", color: tokens.inkMuted,
                        minWidth: { sm: 132 }, flexShrink: 0 }}>
        {label.toUpperCase()}
      </Typography>
      {long && value ? (
        <Box sx={{ minWidth: 0, flex: 1 }}><LongText text={value} max={200} /></Box>
      ) : (
        <Typography variant="body2"
          sx={{ minWidth: 0, wordBreak: "break-word",
                fontFamily: isMono && value ? mono : undefined,
                color: value ? tokens.ink : tokens.inkMuted }}>
          {value || "Not filled in"}
        </Typography>
      )}
    </Stack>
  );
}
