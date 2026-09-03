import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { tokens } from "@/lib/tokens";

/**
 * What the content column shows while the next section loads.
 *
 * The shape of a page rather than a spinner in the middle of nothing: the
 * sidebar stays put, the heading and the first row of cards appear where they
 * are about to be, and the page does not jump when the real thing arrives.
 */
export default function PageSkeleton() {
  return (
    <Box aria-busy="true" aria-label="Loading">
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Skeleton variant="text" width={280} height={44} />
        <Skeleton variant="text" width="min(560px, 80%)" height={26} />
      </Stack>

      <Skeleton variant="rounded" height={96} sx={{ borderRadius: 2, mb: 2.5 }} />

      <Box sx={{ display: "grid", gap: 2.5,
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)",
                   md: "repeat(2, minmax(0, 1fr))",
                   xl: "repeat(3, minmax(0, 1fr))",
                 } }}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={{ borderRadius: 2, border: `1px solid ${tokens.rule}`,
                             backgroundColor: tokens.paper, p: 2.25 }}>
            <Stack direction="row" spacing={1.75} sx={{ alignItems: "center", mb: 2 }}>
              <Skeleton variant="rounded" width={42} height={42} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="35%" height={16} />
              </Box>
            </Stack>
            <Skeleton variant="text" height={18} />
            <Skeleton variant="text" width="70%" height={18} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
