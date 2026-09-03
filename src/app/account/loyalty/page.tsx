import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EmptyState from "@/components/ui/EmptyState";
import PageHead from "@/components/account/PageHead";
import ClubLogo from "@/components/clubs/ClubLogo";
import { getCurrentProfile } from "@/services/auth.service";
import { getDashboard } from "@/services/dashboard.service";
import { mono, tokens } from "@/lib/tokens";

export const metadata = { title: "Your loyalty" };

/**
 * Every loyalty card the member holds, in one place.
 *
 * Legacy only reaches loyalty through a club page, so a member with three
 * clubs has to visit three pages to find out where their points are. This is
 * the way in; each card still opens the club's own loyalty page for the ledger.
 */
export default async function AccountLoyaltyPage() {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/account/loyalty");

  const data = await getDashboard(viewer.id);
  const total = data.loyalty.reduce((n, card) => n + card.available, 0);

  return (
    <>
      <PageHead
        title="Loyalty"
        lede={total
          ? `${total} points across ${data.loyalty.length} club${data.loyalty.length === 1 ? "" : "s"}.`
          : "Points you earn at clubs that run a programme land here."}
      />

      {data.loyalty.length ? (
        <Box sx={{ display: "grid", gap: 2.5,
                   gridTemplateColumns: {
                     xs: "minmax(0, 1fr)",
                     md: "repeat(2, minmax(0, 1fr))",
                     xl: "repeat(3, minmax(0, 1fr))",
                   } }}>
          {data.loyalty.map((card) => (
            <NextLink key={card.clubSlug} href={`/clubs/${card.clubSlug}/loyalty`}
              style={{ textDecoration: "none", color: "inherit" }}>
              <Stack spacing={1.5}
                sx={{ p: 2.5, borderRadius: 2, height: "100%",
                      border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper,
                      "&:hover": { borderColor: tokens.brass } }}>
                <Stack direction="row" spacing={1.75} sx={{ alignItems: "center" }}>
                  <ClubLogo slug={card.clubSlug} name={card.clubName} size={40}
                    ring={tokens.rule} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1">{card.clubName}</Typography>
                    {card.tierLabel ? (
                      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem",
                                        letterSpacing: "0.06em", color: tokens.brass,
                                        fontWeight: 700 }}>
                        {card.tierLabel.toUpperCase()}
                      </Typography>
                    ) : null}
                  </Box>
                  <Typography sx={{ fontFamily: mono, fontSize: "1.6rem", fontWeight: 700,
                                    lineHeight: 1 }}>
                    {card.available}
                  </Typography>
                </Stack>

                <Box>
                  <LinearProgress variant="determinate"
                    value={Math.round(card.progress * 100)}
                    sx={{ height: 7, borderRadius: 4, backgroundColor: tokens.rule,
                          "& .MuiLinearProgress-bar": { backgroundColor: tokens.brass } }} />
                  <Typography variant="body2" sx={{ color: tokens.inkMuted, mt: 0.75 }}>
                    {card.toNext ? `${card.toNext} more to the next tier` : "Top tier reached"}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: "auto" }}>
                  <Typography variant="body2" sx={{ color: tokens.brand, fontWeight: 600 }}>
                    See how you earned it
                  </Typography>
                  <ArrowForwardIcon sx={{ fontSize: 16, color: tokens.brand }} />
                </Stack>
              </Stack>
            </NextLink>
          ))}
        </Box>
      ) : (
        <Box>
          <EmptyState
            title="No loyalty cards yet"
            description="Only some clubs run a points programme. Join one that does and your card appears here."
            action={{ label: "Find a club", href: "/clubs" }}
          />
        </Box>
      )}
    </>
  );
}
