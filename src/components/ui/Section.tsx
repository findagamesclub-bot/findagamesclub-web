import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import { tokens } from "@/lib/tokens";
import { sectionId } from "@/utils/section-id";

export default function Section({
  title,
  icon: Icon,
  note,
  action,
  navLabel,
  children,
}: {
  title: string;
  icon?: SvgIconComponent;
  note?: string;
  action?: React.ReactNode;
  /**
   * Short form for a shortcut nav. "Club nights and table booking" is a fair
   * heading and a poor tab.
   */
  navLabel?: string;
  children: React.ReactNode;
}) {
  const id = sectionId(title);

  return (
    // The id and the label are what SectionNav builds itself from, so the
    // shortcuts list exactly the sections a page actually rendered.
    <Box
      component="section"
      id={id}
      data-section-label={navLabel ?? title}
      sx={{
        mt: 7,
        // Clears the app bar and the sticky shortcuts, so jumping to a section
        // lands on its heading rather than under them.
        scrollMarginTop: { xs: 132, md: 140 },
      }}
    >
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
