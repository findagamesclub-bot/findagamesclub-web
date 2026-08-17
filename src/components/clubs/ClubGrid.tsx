import Box from "@mui/material/Box";
import ClubCard from "./ClubCard";
import ClubCardSkeleton from "./ClubCardSkeleton";
import type { ClubSummary } from "@/types/club";

const GRID = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
  gap: 2,
} as const;

export default function ClubGrid({ clubs }: { clubs: ClubSummary[] }) {
  return (
    <Box sx={GRID}>
      {clubs.map((club) => (
        <ClubCard key={club.slug} club={club} />
      ))}
    </Box>
  );
}

export function ClubGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Box sx={GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <ClubCardSkeleton key={i} />
      ))}
    </Box>
  );
}
