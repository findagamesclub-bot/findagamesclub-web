"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockIcon from "@mui/icons-material/Lock";
import ClubLogo from "@/components/clubs/ClubLogo";
import { confirmationLabel, deploymentLabel } from "@/utils/result-meta";
import { nightLabel } from "@/utils/dates";
import { clubIdentity } from "@/utils/club-identity";
import { mono, tokens } from "@/lib/tokens";
import type { OwnerResult } from "@/services/ownerBookings.service";

/**
 * One game or booking, across clubs.
 *
 * The club badge leads, because the whole point of this page is that the rows
 * come from more than one club and an owner needs to know which before they
 * read anything else.
 */
export default function OwnerResultRow({
  result, edge = null, onOpen,
}: {
  result: OwnerResult;
  /** Colour of the left edge when this row is asking for something. */
  edge?: string | null;
  onOpen?: (result: OwnerResult) => void;
}) {
  const { faction } = clubIdentity(result.club.slug, result.club.name);
  const clickable = Boolean(onOpen);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}
      onClick={() => onOpen?.(result)}
      sx={{ px: 2, py: 1.5, borderRadius: 1.5, alignItems: { sm: "center" },
            cursor: clickable ? "pointer" : "default",
            border: `1px solid ${edge ?? tokens.rule}`,
            backgroundColor: tokens.paper,
            ...(clickable ? { "&:hover": { borderColor: faction.base } } : {}) }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0, flex: 1 }}>
        <ClubLogo slug={result.club.slug} name={result.club.name}
          logoUrl={null} size={32} ring={tokens.rule} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {result.homeName} v {result.awayName}
          </Typography>
          <Typography noWrap sx={{ fontFamily: mono, fontSize: "0.66rem",
                                   letterSpacing: "0.06em", color: tokens.inkMuted }}>
            {[result.club.name, nightLabel(result.date), result.title,
              result.mission, deploymentLabel(result.deployment)]
              .filter(Boolean).join(" · ").toUpperCase()}
          </Typography>
        </Box>
      </Stack>

      <Typography sx={{ fontFamily: mono, fontWeight: 700, flexShrink: 0,
                        fontSize: result.recorded ? "1.05rem" : "0.72rem",
                        color: result.recorded ? tokens.ink : "#5c4310" }}>
        {result.recorded ? `${result.homeScore} – ${result.awayScore}` : "ADD A SCORE"}
      </Typography>

      {result.recorded && result.confirmation !== "submitted" ? (
        <Chip size="small" label={confirmationLabel(result.confirmation)}
          icon={result.locked ? <LockIcon sx={{ fontSize: 13 }} /> : undefined}
          sx={{ fontSize: "0.66rem", height: 22, flexShrink: 0,
                backgroundColor: result.confirmation === "disputed"
                  ? "#FBE9E7" : tokens.brassSoft,
                color: result.confirmation === "disputed" ? "#8a2f22" : "#5c4310",
                "& .MuiChip-icon": { color: "inherit" } }} />
      ) : null}
    </Stack>
  );
}
