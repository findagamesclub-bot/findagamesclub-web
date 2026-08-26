import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import GroupsIcon from "@mui/icons-material/Groups";
import EventIcon from "@mui/icons-material/Event";
import { tokens } from "@/lib/tokens";

/**
 * Clubs or events — what you are searching for.
 *
 * Two routes rather than one page with a mode, because the filters genuinely
 * differ: clubs filter by town, night and travel radius, events by game and
 * whether they have already run. Separate URLs also stay shareable, which a
 * mode held in component state would not be.
 */
export default function SearchModeToggle({ mode }: { mode: "clubs" | "events" }) {
  const item = (value: "clubs" | "events", label: string, href: string, Icon: typeof GroupsIcon) => {
    const active = mode === value;
    return (
      <NextLink href={href} style={{ textDecoration: "none" }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            alignItems: "center",
            px: 1.75, py: 0.875, borderRadius: 999,
            bgcolor: active ? tokens.ink : "transparent",
            color: active ? "#FFFFFF" : tokens.inkMuted,
            transition: "background-color 120ms ease, color 120ms ease",
            "&:hover": active ? {} : { color: tokens.ink },
          }}
        >
          <Icon aria-hidden sx={{ fontSize: 17 }} />
          <Typography sx={{ fontFamily: "var(--font-display)", fontWeight: 600,
                            fontSize: "0.92rem", whiteSpace: "nowrap" }}>
            {label}
          </Typography>
        </Stack>
      </NextLink>
    );
  };

  return (
    <Stack
      direction="row"
      spacing={0.5}
      role="navigation"
      aria-label="Search clubs or events"
      sx={{ p: 0.5, borderRadius: 999, bgcolor: tokens.surface,
            border: `1px solid ${tokens.rule}`, alignSelf: "flex-start" }}
    >
      {item("clubs", "Clubs", "/clubs", GroupsIcon)}
      {item("events", "Events", "/events", EventIcon)}
    </Stack>
  );
}
