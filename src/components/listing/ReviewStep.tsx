import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ChecklistIcon from "@mui/icons-material/FactCheck";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Panel from "@/components/members/Panel";
import HealthBar from "./HealthBar";
import HealthCheck from "./HealthCheck";
import { mono, tokens } from "@/lib/tokens";
import { readinessFields } from "@/utils/listing-readiness";
import type { Check } from "@/utils/listing-readiness";

/**
 * Step 5 for a club that already exists: how the listing is doing.
 *
 * Legacy's fifth step is a submission, with a plan to choose and a Submit
 * button. A live club has neither, so this is the same checks read as a health
 * report. The figure is fields rather than checks because it is the finer of
 * the two: a club one box short of finished should not be told it has failed a
 * whole section.
 */
export default function ReviewStep({
  checks, base, clubSlug,
}: {
  checks: Check[];
  /** `/clubs/didcot/manage/listing` */
  base: string;
  clubSlug: string;
}) {
  const outstanding = checks.filter((c) => !c.ready);
  const { done, total } = readinessFields(checks);

  return (
    <Stack spacing={2.5}>
      <Panel title="Listing health" icon={ChecklistIcon}>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 3 }}
            sx={{ alignItems: { sm: "center" } }}>
            <Stack direction="row" spacing={0.25}
              sx={{ alignItems: "baseline", flexShrink: 0 }}>
              <Typography sx={{ fontFamily: mono, fontSize: "2.1rem", fontWeight: 700,
                                lineHeight: 1, color: tokens.brass }}>
                {done}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "1rem", color: tokens.inkMuted }}>
                /{total}
              </Typography>
            </Stack>

            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <HealthBar checks={checks} />
              <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                                letterSpacing: "0.1em", color: tokens.inkMuted }}>
                {`FIELDS FILLED ACROSS ${checks.length} CHECKS`}
              </Typography>
            </Stack>
          </Stack>

          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {outstanding.length === 0
              ? "Everything is filled in. Nothing here needs you."
              : outstanding.length === 1
                ? "One of these still wants something. It opens the step that fixes it."
                : `${outstanding.length} of these still want something. Each one opens the step that fixes it.`}
          </Typography>

          {/* Two columns where there is room: seven full-width rows is a page of
              scrolling to say a listing is finished. */}
          <Box sx={{ display: "grid", gap: 1.25, alignItems: "stretch",
                     gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                            md: "repeat(2, minmax(0, 1fr))" } }}>
            {checks.map((check) => (
              <HealthCheck key={check.key} check={check} base={base} />
            ))}
          </Box>
        </Stack>
      </Panel>

      <Panel title="What people see" icon={VisibilityIcon}>
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            There is no draft and no submission: everything you save is already
            live. This is your page as it stands.
          </Typography>
          <NextLink href={`/clubs/${clubSlug}`} style={{ textDecoration: "none" }}>
            <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
              Open your club page &rsaquo;
            </Typography>
          </NextLink>
        </Stack>
      </Panel>
    </Stack>
  );
}
