import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import LinkButton from "@/components/ui/LinkButton";
import LongText from "@/components/ui/LongText";
import { claimLabel, claimTone } from "@/utils/claim-status";
import { mono, tokens } from "@/lib/tokens";

/**
 * A club they have asked for, on their own dashboard.
 *
 * Shaped like `ListingResumeCard` on purpose: both answer "something I asked
 * for, where did it get to", and a reader should not have to learn two cards
 * for one question. Without it a claim was invisible the moment they left the
 * club page, so the only way back was remembering the URL.
 *
 * Only a claim still going somewhere gets a card. The service decides which.
 */
export default function ClaimResumeCard({
  club, status, note,
}: {
  club: { slug: string; name: string; city: string | null } | null;
  status: string;
  /** The admin's reason, when it was turned down. */
  note: string;
}) {
  const tone = claimTone(status);
  const colour = tone === "good" ? tokens.positive
    : tone === "bad" ? tokens.danger
      : tone === "warn" ? tokens.brass : tokens.inkMuted;

  const name = club?.name ?? "A club that has gone";
  const declined = status === "declined";

  return (
    <Stack spacing={1.25}
      sx={{ p: 2.5, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
            backgroundColor: tokens.paper }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          A CLUB YOU HAVE ASKED FOR
        </Typography>
        <Chip size="small" label={claimLabel(status)}
          sx={{ bgcolor: colour, color: "#fff", fontWeight: 700, fontSize: "0.68rem" }} />
      </Stack>

      <Typography variant="h3" sx={{ fontSize: "1.15rem" }}>
        {[name, club?.city].filter(Boolean).join(", ")}
      </Typography>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {declined
          ? "We could not hand this one over. You can read why and ask again."
          : "Somebody will look at it and we will email you either way, usually "
            + "within a few days."}
      </Typography>

      {declined && note ? <LongText text={note} lines={4} /> : null}

      {club ? (
        <LinkButton href={`/clubs/${club.slug}`}
          variant="contained" sx={{ alignSelf: "flex-start", mt: 0.5 }}>
          {declined ? "Read why, and ask again" : "See your claim"}
        </LinkButton>
      ) : null}
    </Stack>
  );
}
