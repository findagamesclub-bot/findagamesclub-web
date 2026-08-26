import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PlaceIcon from "@mui/icons-material/Place";
import NearMeIcon from "@mui/icons-material/NearMe";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import { clubIdentity } from "@/utils/club-identity";
import { tokens } from "@/lib/tokens";
import type { MemberProfile } from "@/types/profile";

/**
 * The datasheet's title bar: who, where, how far they will travel.
 *
 * Colour comes from the person's own id, so they keep the same one wherever
 * they turn up. The battle-mat grid is the same 44px one the club artwork and
 * the hero use, so a member reads as part of the same set as a club.
 */
export default function MemberBanner({
  profile, action,
}: {
  profile: MemberProfile;
  action?: React.ReactNode;
}) {
  const { faction, monogram } = clubIdentity(profile.id, profile.fullName);

  const facts = [
    profile.homeArea ? { icon: PlaceIcon, text: profile.homeArea } : null,
    profile.travelMiles != null ? { icon: NearMeIcon, text: `Travels ${profile.travelMiles} miles` } : null,
    profile.memberSince ? { icon: EventAvailableIcon, text: `Member since ${profile.memberSince}` } : null,
  ].filter(Boolean) as { icon: typeof PlaceIcon; text: string }[];

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        overflow: "hidden",
        backgroundColor: faction.deep,
        color: "#FFFFFF",
        backgroundImage: `
          repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 44px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 44px)`,
        borderBottom: `3px solid ${tokens.brassOnDark}`,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 2, sm: 2.5 }}
        sx={{ alignItems: { sm: "center" }, p: { xs: 2.5, md: 3 } }}
      >
        <Box
          aria-hidden
          sx={{
            display: "grid",
            placeItems: "center",
            width: { xs: 64, md: 76 },
            height: { xs: 64, md: 76 },
            flexShrink: 0,
            borderRadius: "50%",
            backgroundColor: faction.base,
            border: `2px solid ${tokens.brassOnDark}`,
            fontFamily: "var(--font-display)",
            fontSize: { xs: "1.35rem", md: "1.6rem" },
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          {monogram}
        </Box>

        <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h1" sx={{ color: "#FFFFFF", fontSize: { xs: "1.9rem", md: "2.6rem" } }}>
            {profile.fullName}
          </Typography>
          {facts.length ? (
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
              {facts.map((fact) => (
                <Stack key={fact.text} direction="row" spacing={0.625} sx={{ alignItems: "center" }}>
                  <fact.icon aria-hidden sx={{ fontSize: 16, color: tokens.brassOnDark }} />
                  <Typography variant="body2" sx={{ color: "#C6D4E4" }}>{fact.text}</Typography>
                </Stack>
              ))}
            </Stack>
          ) : null}
        </Stack>

        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
    </Box>
  );
}
