import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LinkButton from "@/components/ui/LinkButton";
import { headerHeight, mono, tokens } from "@/lib/tokens";

/**
 * The strip that says this page is not the real thing.
 *
 * Everything under it is the club page's own components, which is the point
 * and also the risk: a preview that looks exactly like a published page is one
 * an admin can mistake for a published page. So the bar is dark and sits above
 * the content rather than inside it, the way browser chrome does, and it never
 * scrolls away.
 *
 * It carries the address the listing will get, because that is the one thing
 * on this screen a reviewer cannot work out by looking, and the way back to
 * the decision. The decision itself stays on the review screen: two Approve
 * buttons on two pages is two places for the same irreversible press.
 */
export default function PreviewBar({
  id, slug, name,
}: {
  id: number;
  slug: string;
  name: string;
}) {
  return (
    <Box
      component="aside"
      aria-label={`Preview of ${name}`}
      sx={{
        position: "sticky",
        top: headerHeight,
        zIndex: 20,
        backgroundColor: tokens.ink,
        borderBottom: `1px solid rgba(255,255,255,0.14)`,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1, sm: 2 }}
          sx={{ py: 1.25, alignItems: { sm: "center" },
                justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.25}
            sx={{ alignItems: "center", minWidth: 0 }}>
            <VisibilityIcon aria-hidden
              sx={{ fontSize: 18, color: tokens.brassOnDark, flexShrink: 0 }} />
            <Stack spacing={0.1} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                                letterSpacing: "0.12em", color: tokens.brassOnDark }}>
                PREVIEW · NOT PUBLISHED
              </Typography>
              {/* The address it will get, from the same generator that will
                  give it to them. Worth saying out loud: it is the one thing
                  on the page nobody can work out by looking at it. */}
              <Typography sx={{ fontFamily: mono, fontSize: "0.72rem",
                                color: "#C8D6E8", minWidth: 0,
                                overflow: "hidden", textOverflow: "ellipsis",
                                whiteSpace: "nowrap" }}>
                {`/clubs/${slug}`}
              </Typography>
            </Stack>
          </Stack>

          <LinkButton href={`/admin/submissions/${id}`} size="small" variant="contained"
            sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "auto" },
                  backgroundColor: "#FFFFFF", color: tokens.ink,
                  "&:hover": { backgroundColor: "#E8EFF8" } }}>
            Back to the review
          </LinkButton>
        </Stack>
      </Container>
    </Box>
  );
}
