import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import type { SvgIconComponent } from "@mui/icons-material";
import CategoryIcon from "@mui/icons-material/Category";
import LocalActivityIcon from "@mui/icons-material/LocalActivity";
import CasinoIcon from "@mui/icons-material/Casino";
import { tagLabel } from "@/utils/tag-label";
import { mono, tokens, type Faction } from "@/lib/tokens";

/**
 * What kind of event this is: its format, its type, and the games on the day.
 *
 * All three were stored and none were shown. The directory even filters events
 * by all three, so somebody could search for a wargaming event and then find
 * no mention of wargaming on the event they opened.
 *
 * Each value is the link back to that search. They are the same three
 * parameters the events filters use, so a chip is not a label of a thing, it
 * is the way to the rest of them.
 *
 * One strip with three labelled rows rather than three sections. A tournament
 * page already runs to seven sections, and "Wargaming", "Tournament" and
 * "Warhammer 40,000" as one undifferentiated run of chips reads as noise: they
 * answer three different questions and the labels are what say so.
 */
type Row = {
  key: "formats" | "types" | "games";
  label: string;
  icon: SvgIconComponent;
  /** The events filter this value belongs to. */
  param: "format" | "eventType" | "featuredGame";
};

const ROWS: Row[] = [
  { key: "formats", label: "Format", icon: CategoryIcon, param: "format" },
  { key: "types", label: "Event type", icon: LocalActivityIcon, param: "eventType" },
  { key: "games", label: "Games", icon: CasinoIcon, param: "featuredGame" },
];

export default function EventTags({
  formats, types, games, faction,
}: {
  formats: string[];
  types: string[];
  games: string[];
  /** The club's own colour, for the hover. Identity, not decoration. */
  faction: Faction;
}) {
  // The stored value goes in the link and the tidied one on the face: the
  // filter matches what the club wrote, the reader should not have to.
  const clean = (values: string[]) =>
    values.map((raw) => ({ raw: raw.trim(), label: tagLabel(raw) }))
      .filter((v) => v.raw && v.label);

  const values = { formats: clean(formats), types: clean(types), games: clean(games) };
  const rows = ROWS.filter((row) => values[row.key].length);
  if (!rows.length) return null;

  return (
    // Hairline top and bottom, the same strip the club header's facts sit in.
    // A bordered card here would compete with the seven real sections below.
    <Box sx={{ mt: 3, py: 1.75, display: "grid", rowGap: 1.5,
               borderTop: `1px solid ${tokens.rule}`,
               borderBottom: `1px solid ${tokens.rule}` }}>
      {rows.map(({ key, label, icon: Icon, param }) => (
        <Box key={key}
          sx={{ display: "grid", gap: { xs: 0.625, sm: 1.5 },
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "116px minmax(0, 1fr)" },
                alignItems: "baseline" }}>
          <Stack direction="row" spacing={0.625}
            sx={{ alignItems: "center", pt: { sm: 0.4 } }}>
            <Icon aria-hidden sx={{ fontSize: 15, color: tokens.brass, flexShrink: 0 }} />
            <Typography component="span"
              sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                    letterSpacing: "0.12em", color: tokens.inkMuted, whiteSpace: "nowrap" }}>
              {label.toUpperCase()}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", minWidth: 0 }}>
            {values[key].map((value) => (
              <NextLink key={value.raw}
                href={`/events?${param}=${encodeURIComponent(value.raw)}`}
                aria-label={`${value.label} events`}
                style={{ textDecoration: "none" }}>
                <Box
                  sx={{
                    // Paper, not surface. The facility chips are surface
                    // because they sit inside white sections; this strip sits
                    // on the page ground, which IS surface, so those chips had
                    // no edge to show and the whole block read as flat.
                    backgroundColor: tokens.paper,
                    border: `1px solid ${tokens.rule}`,
                    borderRadius: "3px", px: 1.125, py: 0.5,
                    color: tokens.ink,
                    transition: "border-color 130ms ease, color 130ms ease, background-color 130ms ease",
                    "&:hover": {
                      borderColor: faction.base,
                      backgroundColor: faction.soft,
                      color: faction.deep,
                    },
                  }}>
                  <Typography component="span"
                    sx={{ fontFamily: "var(--font-display)", fontSize: "0.85rem",
                          fontWeight: 500, lineHeight: 1.2, color: "inherit" }}>
                    {value.label}
                  </Typography>
                </Box>
              </NextLink>
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
