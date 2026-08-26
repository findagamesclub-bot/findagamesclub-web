import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import ClubDirectory from "@/components/clubs/ClubDirectory";
import DirectoryHero from "@/components/clubs/DirectoryHero";
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

  // The hero describes the whole directory, so it needs the unfiltered set —
  // otherwise searching for one club would shrink it to "1 club · 1 town".
  const [initialData, options, everything] = await Promise.all([
    listClubs(filters),
    getFilterOptions(),
    listClubs({}),
  ]);

  return (
    <Box component="main">
      <DirectoryHero
        clubs={everything.clubs}
        total={everything.total}
        towns={options.cities.length}
      />

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 5 } }}>
        <ClubDirectory
          initialFilters={filters}
          initialData={initialData}
          options={options}
        />
      </Container>
    </Box>
  );
}
