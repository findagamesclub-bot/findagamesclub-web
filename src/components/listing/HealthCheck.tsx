import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import CheckIcon from "@mui/icons-material/Check";
import PriorityIcon from "@mui/icons-material/PriorityHigh";
import { display, mono, tokens } from "@/lib/tokens";
import type { Check } from "@/utils/listing-readiness";

/** Which step fixes each check, and what that step is called on the stepper. */
const FIXED_ON: Partial<Record<Check["key"], { segment: string; label: string }>> = {
  profile: { segment: "profile", label: "Profile" },
  venue: { segment: "profile", label: "Profile" },
  contact: { segment: "profile", label: "Profile" },
  capacity: { segment: "profile", label: "Profile" },
  content: { segment: "content", label: "Content" },
  pricing: { segment: "pricing", label: "Pricing" },
  schedule: { segment: "schedule", label: "Schedule" },
};

/**
 * One check, as a row of the report.
 *
 * A finished check is quiet: a tick, its name and its count, because there is
 * nothing to do about it. An unfinished one carries the brass, says what is
 * missing and links to the step that fixes it, since a checklist that tells you
 * what is wrong and not where is a checklist somebody has to search.
 */
export default function HealthCheck({
  check, base,
}: {
  check: Check;
  /**
   * Where the builder lives, for the link that fixes this check. Empty on a
   * screen whose reader is not the one who can fix it, which is the admin
   * reviewing somebody else's listing: there the step is named and not linked,
   * rather than linked to a page that is not theirs to open.
   */
  base: string;
}) {
  const fix = FIXED_ON[check.key];

  return (
    <Stack spacing={0.5} sx={{ height: "100%", p: 1.5, borderRadius: 1.5,
          border: `1px solid ${check.ready ? tokens.rule : tokens.brass}`,
          backgroundColor: check.ready ? tokens.paper : tokens.brassSoft }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box sx={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                   display: "grid", placeItems: "center", color: "#fff",
                   backgroundColor: check.ready ? tokens.positive : tokens.brass }}>
          {check.ready ? <CheckIcon sx={{ fontSize: 13 }} />
                       : <PriorityIcon sx={{ fontSize: 13 }} />}
        </Box>
        <Typography sx={{ fontFamily: display, fontSize: "0.95rem", fontWeight: 700,
                          flex: 1, minWidth: 0 }}>
          {check.label}
        </Typography>
        <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", fontWeight: 700,
                          color: check.ready ? tokens.inkMuted : tokens.brass }}>
          {check.done}/{check.total}
        </Typography>
      </Stack>

      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {check.wants}
      </Typography>

      {/* Only the unfinished ones say more, and only the one thing that is not
          already on the card. Legacy's note line said "3 of 5 required fields
          completed" beside a figure reading 3/5. */}
      {!check.ready && fix ? (
        <Box sx={{ mt: "auto", pt: 0.5 }}>
          {base ? (
            <NextLink href={`${base}/${fix.segment}`} style={{ textDecoration: "none" }}>
              <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                {`Fix in ${fix.label} `}&rsaquo;
              </Typography>
            </NextLink>
          ) : (
            <Typography variant="body2" sx={{ color: tokens.inkMuted, fontWeight: 600 }}>
              {`On ${fix.label}`}
            </Typography>
          )}
        </Box>
      ) : null}
    </Stack>
  );
}
