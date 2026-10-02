import NextLink from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Section from "@/components/ui/Section";
import { display, mono, tokens } from "@/lib/tokens";
import type { CatalogueFaction } from "@/utils/army-catalogue";

/**
 * One faction as it was published, read only.
 *
 * Points as text, which is how the snapshot stores them and how the pricing
 * reads them. Formatting a number here would quietly disagree with what the
 * builder charged.
 */
export default function FrozenFaction({
  faction, backHref,
}: {
  faction: CatalogueFaction;
  backHref: string;
}) {
  return (
    <>
      <NextLink href={backHref} style={{ textDecoration: "none" }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, mb: 2,
                   color: tokens.brand, fontWeight: 600 }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          Every faction in this version
        </Box>
      </NextLink>

      <Section title={faction.label} navLabel={faction.label} flush
        note={`${faction.detachmentOptions.length} detachments and ${faction.units.length} units, exactly as they were published.`}>
        <Stack spacing={3}>
          {faction.detachmentOptions.length ? (
            <Stack spacing={1}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                DETACHMENTS
              </Typography>
              {faction.detachmentOptions.map((one) => (
                <Box key={one.id}
                  sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1,
                        backgroundColor: tokens.paper, p: 1.5 }}>
                  <Typography sx={{ fontFamily: display, fontWeight: 600 }}>
                    {one.label}
                  </Typography>
                  {one.dispositions.length ? (
                    <Typography sx={{ mt: 0.4, fontFamily: mono, fontSize: "0.68rem",
                                      letterSpacing: "0.05em", color: tokens.inkMuted }}>
                      {one.dispositions.join(" · ").toUpperCase()}
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ mt: 0.4, color: tokens.inkMuted }}>
                      No dispositions were set on this one.
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          ) : null}

          <Stack spacing={1}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              UNITS
            </Typography>
            {faction.units.map((unit) => (
              <Stack key={unit.name} direction="row" spacing={2}
                sx={{ alignItems: "baseline", justifyContent: "space-between",
                      border: `1px solid ${tokens.rule}`, borderRadius: 1,
                      backgroundColor: tokens.paper, px: 1.75, py: 1.25 }}>
                <Typography sx={{ minWidth: 0 }}>{unit.name}</Typography>
                <Typography sx={{ fontFamily: mono, fontWeight: 700, flexShrink: 0,
                                  color: tokens.brass }}>
                  {unit.points}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Section>
    </>
  );
}
