import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";

/** An empty screen is an invitation to act, so the copy names the next step. */
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: { xs: 6, md: 9 },
        px: 3,
        border: `1px dashed ${tokens.rule}`,
        borderRadius: 1,
        background: tokens.paper,
      }}
    >
      <Stack spacing={1.5} sx={{ alignItems: "center", maxWidth: 420, mx: "auto" }}>
        <Typography variant="h4" component="p">{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
        {action ? (
          <Button href={action.href} variant="outlined" sx={{ mt: 1 }}>{action.label}</Button>
        ) : null}
      </Stack>
    </Box>
  );
}
