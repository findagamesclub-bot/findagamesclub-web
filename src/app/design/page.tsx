import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ClubGrid, { ClubGridSkeleton } from "@/components/clubs/ClubGrid";
import StatLine from "@/components/ui/StatLine";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Section from "@/components/ui/Section";
import { tokens } from "@/lib/tokens";
import type { ClubSummary } from "@/types/club";
import clubs from "@/fixtures/clubs.sample.json";

export const metadata = { title: "Design system" };

const sample = clubs as ClubSummary[];

export default function DesignSystemPage() {
  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 5, md: 8 } }}>
      <Stack spacing={1.5} sx={{ maxWidth: 720 }}>
        <Typography variant="overline" sx={{ color: tokens.brass }}>
          Milestone 1 · Stage 1
        </Typography>
        <Typography variant="h1">Design system</Typography>
        <Typography variant="body1" color="text.secondary">
          The listing borrows the format its audience already reads every week: the
          datasheet. Condensed labels, serif body, tabular figures, hairline rules.
          Everything here uses real club data from the existing site.
        </Typography>
      </Stack>

      <Section
        title="Typefaces"
        note="Three faces, one job each. Archivo carries structure, Source Serif carries reading, IBM Plex Mono carries numbers."
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              Archivo · display and labels
            </Typography>
            <Typography variant="h2">Find a club you will actually turn up to</Typography>
          </Box>
          <Divider />
          <Box>
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              Source Serif 4 · body
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 620 }}>
              Tabletop and board games in the Didcot area. We meet every Thursday from
              seven until eleven at North Moreton Village Hall. Terrain and tables are
              provided, and new players are welcome without booking ahead.
            </Typography>
          </Box>
          <Divider />
          <Box>
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              IBM Plex Mono · figures
            </Typography>
            <Typography sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: "1.1rem" }}>
              Thu 19:00 · 10 tables · 212 members · £8
            </Typography>
          </Box>
        </Stack>
      </Section>

      <Section title="Palette" note="Brass appears on data and featured state only. Used decoratively it would read as generic.">
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          {Object.entries({
            Ink: tokens.ink,
            Brand: tokens.brand,
            "Brand deep": tokens.brandDeep,
            Brass: tokens.brass,
            Surface: tokens.surface,
            Rule: tokens.rule,
          }).map(([name, hex]) => (
            <Box key={name} sx={{ width: 130 }}>
              <Box sx={{ height: 56, borderRadius: 1, background: hex, border: `1px solid ${tokens.rule}` }} />
              <Typography variant="overline" sx={{ display: "block", mt: 0.75 }}>
                {name}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "text.secondary" }}>
                {hex}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section title="The stat line" note="The signature element. Missing values show a dash so columns stay aligned and a gap reads as 'not stated'.">
        <Box sx={{ maxWidth: 560, background: tokens.paper, border: `1px solid ${tokens.rule}`, borderRadius: 1, p: 2.5 }}>
          <Typography variant="h4" sx={{ mb: 1.5 }}>
            Didcot Wargames
          </Typography>
          <StatLine
            stats={[
              { label: "Meets", value: "Thu 19:00" },
              { label: "Tables", value: 10 },
              { label: "Members", value: 40 },
              { label: "From", value: null },
            ]}
          />
        </Box>
      </Section>

      <Section title="Club cards" note="Real data, including the awkward parts: clubs with no price set, no table booking, or inconsistent game name casing.">
        <ClubGrid clubs={sample.slice(0, 6)} />
      </Section>

      <Section title="Controls">
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button variant="contained" size="large">
              Find a club
            </Button>
            <Button variant="contained">Save search</Button>
            <Button variant="outlined">Filters</Button>
            <Button variant="text">Clear</Button>
            <Button variant="contained" color="secondary">
              Featured
            </Button>
          </Stack>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", maxWidth: 640 }}>
            <TextField label="Town or postcode" placeholder="Didcot, or OX11" sx={{ flex: "1 1 220px" }} />
            <TextField label="Game" placeholder="Warhammer 40,000" sx={{ flex: "1 1 220px" }} />
          </Stack>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {["Warhammer 40,000", "Age of Sigmar", "Kill Team", "Board games"].map((g) => (
              <Chip key={g} label={g} size="small" variant="outlined" />
            ))}
          </Stack>
        </Stack>
      </Section>

      <Section title="Loading" note="Mirrors the card layout so nothing jumps when data arrives.">
        <ClubGridSkeleton count={3} />
      </Section>

      <Section title="Empty and error" note="An empty screen names what to do next. An error says what happened and how to fix it.">
        <Stack spacing={3}>
          <EmptyState
            title="No clubs within 20 miles of OX11"
            description="Try widening the distance, or clear the game filter to see everything nearby."
            action={{ label: "Clear filters", href: "/design" }}
          />
          <ErrorState message="We could not reach the club directory. Your filters are still saved." retryHref="/design" />
        </Stack>
      </Section>
    </Container>
  );
}
