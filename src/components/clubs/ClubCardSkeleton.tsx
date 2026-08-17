import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { tokens } from "@/lib/tokens";

/** Mirrors ClubCard's shape so the layout doesn't jump when data arrives. */
export default function ClubCardSkeleton() {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Skeleton variant="text" width="65%" height={30} />
        <Skeleton variant="text" width="35%" height={16} sx={{ mb: 1.5 }} />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 2,
            borderTop: `1px solid ${tokens.rule}`,
            borderBottom: `1px solid ${tokens.rule}`,
            py: 1.25,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Box key={i}>
              <Skeleton variant="text" width="70%" height={12} />
              <Skeleton variant="text" width="55%" height={20} />
            </Box>
          ))}
        </Box>
        <Skeleton variant="text" width="100%" height={18} sx={{ mt: 1.5 }} />
        <Skeleton variant="text" width="80%" height={18} />
        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }}>
          <Skeleton variant="rounded" width={64} height={24} />
          <Skeleton variant="rounded" width={80} height={24} />
        </Stack>
      </CardContent>
    </Card>
  );
}
