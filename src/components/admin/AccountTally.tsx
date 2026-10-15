import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

/**
 * How much of each thing the site holds on this person.
 *
 * Figures, never rows. Each of these has a screen of its own already, and a
 * page that loaded somebody's three hundred messages to print "300" is the
 * scale rule broken for a number.
 *
 * Grouped the way an admin reads them rather than the way the tables are
 * arranged: what they have taken part in, what they have written, and what has
 * been said about them. That last group is the one a suspension turns on, so
 * it is last and it is the one that carries colour.
 *
 * A zero is drawn, not hidden. "They have written nothing" is an answer to the
 * question this panel exists for, and an absent row would read as a figure we
 * do not have.
 */

const GROUPS: { title: string; keys: { key: string; label: string }[] }[] = [
  {
    title: "Taken part",
    keys: [
      { key: "tableBookings", label: "Table bookings" },
      { key: "eventTickets", label: "Event tickets" },
      { key: "coaching", label: "Coaching places" },
      { key: "orders", label: "Shop orders" },
      { key: "badges", label: "Badges held" },
      { key: "armyLists", label: "Army lists" },
    ],
  },
  {
    title: "Written",
    keys: [
      { key: "boardPosts", label: "Board posts" },
      { key: "boardReplies", label: "Board replies" },
      { key: "reviews", label: "Reviews" },
      { key: "messages", label: "Messages sent" },
    ],
  },
  {
    title: "Asked and reported",
    keys: [
      { key: "listings", label: "Listings started" },
      { key: "claims", label: "Club claims" },
      { key: "reportsFiled", label: "Reports they filed" },
      { key: "reportsAbout", label: "Reports about them" },
    ],
  },
];

export default function AccountTally({ tally }: { tally: Record<string, number> }) {
  if (!Object.keys(tally).length) {
    return (
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Nothing was read, so this is not an empty record. Check the latest
        migrations have been run, then try again.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      {GROUPS.map((group) => (
        <Stack key={group.title} spacing={1}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.62rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            {group.title.toUpperCase()}
          </Typography>
          <Box sx={{ display: "grid", gap: 1.25,
                     gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))",
                                            sm: "repeat(3, minmax(0, 1fr))" } }}>
            {group.keys.map(({ key, label }) => {
              const value = Number(tally[key] ?? 0);
              // Reports ABOUT somebody are the figure a suspension turns on,
              // so that one is allowed to shout. Everything else is a fact.
              const loud = key === "reportsAbout" && value > 0;
              return (
                <Stack key={key} spacing={0.1}>
                  <Typography sx={{ fontFamily: mono, fontSize: "1.3rem", fontWeight: 700,
                                    lineHeight: 1.1,
                                    color: loud ? tokens.danger
                                      : value > 0 ? tokens.brass : tokens.inkMuted }}>
                    {value.toLocaleString("en-GB")}
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                                    letterSpacing: "0.07em", color: tokens.inkMuted }}>
                    {label.toUpperCase()}
                  </Typography>
                </Stack>
              );
            })}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
