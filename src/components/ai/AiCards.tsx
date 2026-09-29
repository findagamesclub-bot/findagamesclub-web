import Box from "@mui/material/Box";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";

/**
 * The pieces every generated card is built from.
 *
 * One set for all four features, because they say the same kinds of thing: a
 * paragraph, a list of points, and a list of titled notes some of which carry
 * a severity. Four bespoke cards would drift the first time any one of them
 * was touched, and the first thing to drift would be what a severity looks
 * like.
 */

export type Note = { title: string; detail: string; severity?: string; status?: string };

const TONES: Record<string, string> = {
  high: tokens.danger, medium: tokens.brass, low: tokens.inkMuted,
  weak: tokens.danger, watch: tokens.brass, strong: tokens.inkMuted,
};

export function Lede({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: "1rem", lineHeight: 1.6 }}>{children}</Typography>
  );
}

export function Points({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {title.toUpperCase()}
      </Typography>
      <Stack component="ul" spacing={0.75} sx={{ pl: 2.5, m: 0 }}>
        {items.map((one, index) => (
          <Typography key={index} component="li" variant="body2">{one}</Typography>
        ))}
      </Stack>
    </Stack>
  );
}

/**
 * Titled notes as a grid, three across, like every other list in this app.
 *
 * A severity is a word and a colour, never a colour alone: the house rule that
 * colour must not carry meaning by itself applies to a generated card the same
 * as to a status chip.
 */
export function Notes({ title, items }: { title: string; items: Note[] }) {
  if (!items?.length) return null;
  return (
    <Stack spacing={1.25}>
      {/* Blank inside a tab, which already names the section. */}
      {title ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {title.toUpperCase()}
        </Typography>
      ) : null}
      <Box sx={{ display: "grid", gap: 1.5, alignItems: "stretch",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                        lg: "repeat(3, minmax(0, 1fr))" } }}>
        {items.map((one, index) => {
          const tag = String(one.severity ?? one.status ?? "").trim().toLowerCase();
          return (
            <Stack key={index} spacing={0.75}
              sx={{ height: "100%", p: 1.75, borderRadius: 1.5,
                    border: `1px solid ${tokens.rule}`,
                    backgroundColor: tokens.paper }}>
              <Stack direction="row" spacing={1}
                sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.3 }}>
                  {one.title}
                </Typography>
                {tag ? (
                  <Typography sx={{ fontFamily: mono, fontSize: "0.6rem", fontWeight: 700,
                                    letterSpacing: "0.08em", whiteSpace: "nowrap",
                                    color: TONES[tag] ?? tokens.inkMuted }}>
                    {tag.toUpperCase()}
                  </Typography>
                ) : null}
              </Stack>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                {one.detail}
              </Typography>
            </Stack>
          );
        })}
      </Box>
    </Stack>
  );
}

/**
 * Sentences as cards, for the things that are going right.
 *
 * No heading, because there is not one. The first version split each sentence
 * on its first comma to make a title, and on "enough objective and utility
 * pieces to support actions, screens, and wider board coverage" that comma is
 * in the middle of a list: the card read as a broken sentence. A strength is
 * one statement, so it is one paragraph in a card the same size as the others.
 *
 * Cards rather than bullets for the reason the client found: beside two grids
 * of cards a run of bullets reads as a footnote and gets missed entirely.
 */
export function Good({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <Stack spacing={1.25}>
      {title ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.1em", color: tokens.inkMuted }}>
          {title.toUpperCase()}
        </Typography>
      ) : null}
      <Box sx={{ display: "grid", gap: 1.5, alignItems: "stretch",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                        lg: "repeat(3, minmax(0, 1fr))" } }}>
        {items.map((one, index) => (
          <Stack key={index} direction="row" spacing={1.25}
            sx={{ height: "100%", p: 1.75, borderRadius: 1.5,
                  alignItems: "flex-start",
                  border: `1px solid ${tokens.rule}`,
                  backgroundColor: tokens.paper }}>
            <CheckCircleOutlineIcon
              sx={{ fontSize: 19, color: tokens.brass, mt: 0.2, flexShrink: 0 }} />
            <Typography variant="body2">{one}</Typography>
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}

/** What the model named that the catalogue does not have. Said, never hidden. */
export function Dropped({ names }: { names: string[] }) {
  if (!names?.length) return null;
  return (
    <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
      {`${names.length} suggestion${names.length === 1 ? "" : "s"} named `
        + `${names.length === 1 ? "a unit" : "units"} this catalogue does not have `
        + `(${names.join(", ")}), so ${names.length === 1 ? "it was" : "they were"} left out.`}
    </Typography>
  );
}
