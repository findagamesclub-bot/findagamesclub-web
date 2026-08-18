import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import { tokens } from "@/lib/tokens";

export default function Section({
  title,
  icon: Icon,
  note,
  action,
  children,
}: {
  title: string;
  icon?: SvgIconComponent;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box component="section" sx={{ mt: 7 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", pb: 1, borderBottom: `1px solid ${tokens.rule}` }}
      >
        {Icon ? <Icon aria-hidden sx={{ fontSize: 18, color: tokens.brass }} /> : null}
        <Typography variant="overline" sx={{ color: "text.secondary" }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {action}
      </Stack>
      {note ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 2.5, maxWidth: 620 }}>
          {note}
        </Typography>
      ) : (
        <Box sx={{ mb: 2.5 }} />
      )}
      {children}
    </Box>
  );
}
