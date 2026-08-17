import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ClubDirectory from "@/components/clubs/ClubDirectory";
import { getFilterOptions, listClubs } from "@/services/clubs.service";
import type { ClubListFilters } from "@/lib/query/keys";

export const metadata = {
  title: "Find a club",
  description: "Search tabletop and wargaming clubs across the UK by town, game, meeting day and distance.",
};

export default async function ClubsPage({ searchParams }: PageProps<"/clubs">) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const filters: ClubListFilters = {
    q: first(params.q),
    city: first(params.city),
    format: first(params.format),
    day: first(params.day),
    location: first(params.location),
    withinMiles: first(params.withinMiles),
    reviewRating: first(params.reviewRating),
    sort: first(params.sort) ?? "relevance",
    page: Number(first(params.page) ?? 1),
  };

  const [initialData, options] = await Promise.all([listClubs(filters), getFilterOptions()]);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={1} sx={{ maxWidth: 640, mb: 4 }}>
        <Typography variant="overline" color="text.secondary">Directory</Typography>
        <Typography variant="h1">Find a club you will actually turn up to</Typography>
        <Typography variant="body1" color="text.secondary">
          Tabletop and wargaming clubs across the UK. Filter by town, what they
          play, the night they meet, or how far you will travel.
        </Typography>
      </Stack>

      <ClubDirectory initialFilters={filters} initialData={initialData} options={options} />
    </Container>
  );
}
