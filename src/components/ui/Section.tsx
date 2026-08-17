import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="section" sx={{ mt: 7 }}>
      <Typography variant="overline" sx={{ color: "text.secondary" }}>{title}</Typography>
      {note ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5, maxWidth: 620 }}>
          {note}
        </Typography>
      ) : (
        <Box sx={{ mb: 2.5 }} />
      )}
      {children}
    </Box>
  );
}
