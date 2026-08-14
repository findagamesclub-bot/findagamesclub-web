import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const stack = [
  { label: "Next.js 16", detail: "App Router, React 19, Turbopack" },
  { label: "Material UI 9", detail: "Themed, light and dark" },
  { label: "Supabase", detail: "Postgres, Auth, Storage" },
  { label: "Resend", detail: "Transactional email" },
  { label: "Vercel", detail: "Hosting" },
];

export default function Home() {
  return (
    <Container maxWidth="md" component="main" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={4}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" color="primary">
            Milestone 1 · Foundation
          </Typography>
          <Typography variant="h1">FindAGamesClub</Typography>
          <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 400 }}>
            Rebuild in progress. This page confirms the project scaffolding is
            wired up correctly.
          </Typography>
        </Stack>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h4">Stack</Typography>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ flexWrap: "wrap" }}
              >
                {stack.map((item) => (
                  <Chip
                    key={item.label}
                    label={item.label}
                    title={item.detail}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h4">Theme check</Typography>
              <Typography color="text.secondary">
                Buttons, colours and typography below are driven by the shared
                theme in <code>src/theme.ts</code>.
              </Typography>
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Button variant="contained">Primary</Button>
                <Button variant="outlined">Outlined</Button>
                <Button variant="text">Text</Button>
                <Button variant="contained" color="secondary">
                  Secondary
                </Button>
              </Stack>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                Brand colour, carried across from the existing site.
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
