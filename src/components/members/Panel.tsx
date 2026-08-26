import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import { tokens } from "@/lib/tokens";

/**
 * One block of a datasheet. Tighter than `Section`, which spaces itself for a
 * full-width page and would leave a two-column grid full of gaps.
 */
export default function Panel({
  title, icon: Icon, children,
}: {
  title: string;
  icon?: SvgIconComponent;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        border: `1px solid ${tokens.rule}`,
        borderRadius: 1.5,
        backgroundColor: tokens.paper,
        p: { xs: 2, sm: 2.5 },
      }}
    >
      <Stack direction="row" spacing={0.875} sx={{ alignItems: "center", mb: 1.5 }}>
        {Icon ? <Icon aria-hidden sx={{ fontSize: 17, color: tokens.brass }} /> : null}
        <Typography variant="overline" color="text.secondary">{title}</Typography>
      </Stack>
      {children}
    </Box>
  );
}
