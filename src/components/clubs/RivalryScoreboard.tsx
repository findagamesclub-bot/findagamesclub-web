import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { Rivalry } from "@/services/games.service";

/**
 * The contest itself, in one panel.
 *
 * Two stacked cards said who had how many wins but never showed the shape of
 * it. A split bar does: a 5-0 and a 3-2 read differently at a glance, which is
 * the whole question a rivalry page is asked.
 *
 * The two sides keep one colour each — the club's faction for the first, near
 * black for the second — carried by a dot beside each name and by that side's
 * segment of every bar. Colour is never the only cue: the numbers sit at their
 * own ends and every figure is named.
 */
export default function RivalryScoreboard({
  rivalry, faction, viewerId,
}: {
  rivalry: Rivalry;
  faction: Faction;
  viewerId: string | null;
}) {
  const { one, two, played, draws } = rivalry;
  const sideOne = { text: faction.deep, bar: faction.base };
  const sideTwo = { text: tokens.ink, bar: tokens.inkMuted };
  const scored = one.average !== null || two.average !== null;

  return (
    <Box sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
               backgroundColor: tokens.paper, overflow: "hidden" }}>
      <Stack spacing={{ xs: 3, sm: 3.5 }} sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "grid", gap: 1.5, alignItems: "start",
                   gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)" }}>
          <Name who={one} side={sideOne} you={viewerId === one.id} />
          <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", fontWeight: 700,
                            letterSpacing: "0.14em", color: tokens.inkMuted, pt: 0.5 }}>
            VS
          </Typography>
          <Name who={two} side={sideTwo} you={viewerId === two.id} align="right" />
        </Box>

        <Metric
          label="Results"
          note={`${played} ${played === 1 ? "game" : "games"}${draws ? ` · ${draws} ${draws === 1 ? "draw" : "draws"}` : ""}`}
          left={{ value: one.wins, unit: one.wins === 1 ? "win" : "wins", color: sideOne.text }}
          right={{ value: two.wins, unit: two.wins === 1 ? "win" : "wins", color: sideTwo.text }}
          segments={[
            { key: "one", value: one.wins, color: sideOne.bar },
            { key: "draws", value: draws, color: tokens.rule },
            { key: "two", value: two.wins, color: sideTwo.bar },
          ]}
        />

        {scored ? (
          <Metric
            label="Points"
            note={`${one.score + two.score} scored between them`}
            left={{ value: one.score, unit: one.average === null ? "scored" : `${one.average} a game`,
                    color: sideOne.text }}
            right={{ value: two.score, unit: two.average === null ? "scored" : `${two.average} a game`,
                     color: sideTwo.text }}
            segments={[
              { key: "one", value: one.score, color: sideOne.bar },
              { key: "two", value: two.score, color: sideTwo.bar },
            ]}
          />
        ) : null}
      </Stack>

      {rivalry.nominations > 0 ? (
        <Stack direction="row" spacing={1.25}
          sx={{ alignItems: "center", px: { xs: 2, sm: 3 }, py: 1.5,
                borderTop: `1px solid ${tokens.rule}`, backgroundColor: tokens.surface }}>
          {rivalry.mutual
            ? <SyncAltIcon sx={{ fontSize: 18, color: faction.base }} />
            : <ArrowRightAltIcon sx={{ fontSize: 20, color: tokens.inkMuted }} />}
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {rivalry.mutual
              ? "Both of them have named the other a rival, which is the sort worth watching."
              : "One of them has named the other a rival. It is not mutual yet."}
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}

function Name({ who, side, you, align = "left" }: {
  who: Rivalry["one"];
  side: { text: string; bar: string };
  you: boolean;
  align?: "left" | "right";
}) {
  return (
    <Box sx={{ minWidth: 0, textAlign: align }}>
      <NextLink href={`/members/${who.id}`} style={{ textDecoration: "none" }}>
        <Stack direction={align === "right" ? "row-reverse" : "row"} spacing={1}
          sx={{ alignItems: "center", justifyContent: align === "right" ? "flex-start" : undefined }}>
          {/* Ties the name to its colour in the bars below, so the split is
              readable without guessing whose end is whose. */}
          <Box sx={{ width: 10, height: 10, borderRadius: "3px", flexShrink: 0,
                     backgroundColor: side.bar }} />
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: side.text,
                            lineHeight: 1.25, "&:hover": { textDecoration: "underline" } }}>
            {who.name}
          </Typography>
        </Stack>
      </NextLink>
      {you ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                          letterSpacing: "0.12em", color: tokens.inkMuted, mt: 0.5 }}>
          YOU
        </Typography>
      ) : null}
    </Box>
  );
}

function Metric({ label, note, left, right, segments }: {
  label: string;
  note: string;
  left: { value: number; unit: string; color: string };
  right: { value: number; unit: string; color: string };
  segments: { key: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <Box>
      <Box sx={{ display: "grid", gap: 1, alignItems: "end", mb: 1.25,
                 gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)" }}>
        <Figure {...left} />
        <Box sx={{ textAlign: "center", pb: 0.25 }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", fontWeight: 700,
                            letterSpacing: "0.12em", color: tokens.ink }}>
            {label.toUpperCase()}
          </Typography>
          <Typography sx={{ fontFamily: mono, fontSize: "0.66rem", color: tokens.inkMuted,
                            mt: 0.25 }}>
            {note}
          </Typography>
        </Box>
        <Figure {...right} align="right" />
      </Box>

      <Box sx={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden",
                 backgroundColor: tokens.rule }}>
        {total > 0
          ? segments.filter((s) => s.value > 0).map((s) => (
              <Box key={s.key}
                sx={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
            ))
          : null}
      </Box>
    </Box>
  );
}

function Figure({ value, unit, color, align = "left" }: {
  value: number; unit: string; color: string; align?: "left" | "right";
}) {
  return (
    <Box sx={{ textAlign: align, minWidth: 0 }}>
      <Typography sx={{ fontFamily: mono, fontVariantNumeric: "tabular-nums", color,
                        fontSize: { xs: "1.7rem", sm: "2.1rem" }, fontWeight: 700,
                        lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontFamily: mono, fontSize: "0.68rem", color: tokens.inkMuted,
                        mt: 0.5 }}>
        {unit}
      </Typography>
    </Box>
  );
}
