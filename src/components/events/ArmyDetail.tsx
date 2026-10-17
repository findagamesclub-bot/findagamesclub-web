"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { armySummary } from "@/utils/army-snapshot";
import { deploymentLabel } from "@/utils/result-meta";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { ResultArmy } from "@/types/event";

/**
 * One side of a game, as a reader sees it.
 *
 * Lifted out of `ArmyListDialog` when the match dialog arrived, because both
 * draw the same thing and two copies of "render an army" would have disagreed
 * about a list the first time either was touched. The dialog is still the
 * page's only way in; this is what it puts inside.
 */
export default function ArmyDetail({
  player, army, faction, scoreLine, listMode = "full", onShowList,
}: {
  player: string;
  army: ResultArmy | null;
  faction: Faction;
  /** The game's own score for this side, where the caller has one. */
  scoreLine?: string;
  /**
   * How much of the list to draw.
   *
   * "full" is `ArmyListDialog`, which exists to show one, so it prints every
   * unit. "summary" is the match dialog, which already holds two of these
   * side by side: two full lists in one dialog is the printout the client
   * asked to be rid of on a placing, and the same argument applies here.
   */
  listMode?: "full" | "summary";
  /** Given with "summary", so the name has somewhere to lead. */
  onShowList?: () => void;
}) {
  const list = army?.list ?? null;
  const summary = armySummary(army);
  const vp = army?.primaryScore ?? null;
  const secondary = army?.secondaryScore ?? null;

  // Only drawn where the club recorded it. A side with nothing beyond a
  // faction should not sprout an empty row of labels.
  const scoring = [
    vp === null ? null : `Primary ${vp}`,
    secondary === null ? null : `Secondary ${secondary}`,
    army?.painted ? "Fully painted +10" : null,
  ].filter(Boolean).join(" · ");

  const setup = [
    army?.firstTurn === "first" ? "Went first" : army?.firstTurn === "second" ? "Went second" : null,
    army?.battleRole === "attacker" ? "Attacker"
      : army?.battleRole === "defender" ? "Defender" : null,
  ].filter(Boolean).join(" · ");

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1}
        sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{player || "Player"}</Typography>
        {scoreLine ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.9rem", fontWeight: 700,
                            fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {scoreLine}
          </Typography>
        ) : null}
      </Stack>

      {summary ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>{summary}</Typography>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          No army was recorded for this side.
        </Typography>
      )}

      {scoring ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
          {scoring.toUpperCase()}
        </Typography>
      ) : null}

      {setup ? (
        <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", color: tokens.inkMuted }}>
          {setup.toUpperCase()}
        </Typography>
      ) : null}

      <UnitRow label="MVP" units={army?.mvpUnits ?? []}
        bg={faction.soft} fg={faction.deep} />

      {/* The other half of the same question, and it was recorded, carried
          through `readerArmy` and then never drawn: the club typed "Units that
          did not" into the result and no reader ever saw one. Quiet rather
          than coloured, because the faction colour is the badge of honour on
          the row above and these are the opposite of that. */}
      <UnitRow label="UNDERPERFORMED" units={army?.underwhelmingUnits ?? []}
        bg={tokens.surface} fg={tokens.inkMuted} outlined />

      {list && listMode === "summary" ? (
        <Stack direction="row" spacing={1} useFlexGap
          sx={{ mt: 0.5, alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                            letterSpacing: "0.1em", color: tokens.inkMuted }}>
            {(list.name ?? "ARMY LIST").toUpperCase()}
          </Typography>
          {list.totalPoints ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                              color: tokens.brass, fontWeight: 700 }}>
              {`${list.totalPoints} pts`}
            </Typography>
          ) : null}
          {onShowList ? (
            <Button size="small" variant="text" onClick={onShowList}
              sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: "0.72rem",
                    color: faction.deep }}>
              See the list
            </Button>
          ) : null}
        </Stack>
      ) : null}

      {list && listMode === "full" ? (
        <Box sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={1}
            sx={{ alignItems: "baseline", flexWrap: "wrap", mb: 1 }}>
            <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                              letterSpacing: "0.1em", color: tokens.inkMuted }}>
              {(list.name ?? "ARMY LIST").toUpperCase()}
            </Typography>
            {list.totalPoints ? (
              <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                                color: tokens.brass, fontWeight: 700 }}>
                {`${list.totalPoints} pts`}
              </Typography>
            ) : null}
          </Stack>

          <Box>
            {list.units.map((unit) => (
              <Stack key={unit.name} direction="row" spacing={1}
                sx={{ justifyContent: "space-between", py: 0.4,
                      borderBottom: `1px solid ${tokens.rule}` }}>
                <Typography variant="body2" sx={{ fontSize: "0.85rem", minWidth: 0 }}>
                  {unit.quantity > 1 ? `${unit.quantity} × ` : ""}{unit.name}
                </Typography>
                <Typography sx={{ fontFamily: mono, fontSize: "0.78rem",
                                  fontVariantNumeric: "tabular-nums",
                                  color: tokens.inkMuted, flexShrink: 0 }}>
                  {unit.points}
                </Typography>
              </Stack>
            ))}
          </Box>
        </Box>
      ) : null}
    </Stack>
  );
}

/**
 * A labelled row of unit chips.
 *
 * MVP and the underperformers are the same shape and were one copy away from
 * being two: the second one is why this exists rather than a second block of
 * markup under the first.
 */
function UnitRow({ label, units, bg, fg, outlined = false }: {
  label: string;
  units: string[];
  bg: string;
  fg: string;
  outlined?: boolean;
}) {
  if (!units.length) return null;
  return (
    <Stack direction="row" spacing={0.75} useFlexGap
      sx={{ flexWrap: "wrap", alignItems: "baseline" }}>
      <Typography sx={{ fontFamily: mono, fontSize: "0.64rem",
                        letterSpacing: "0.1em", color: tokens.inkMuted }}>
        {label}
      </Typography>
      {units.map((unit) => (
        <Box key={unit}
          sx={{ px: 1, py: 0.3, borderRadius: 0.75, bgcolor: bg, color: fg,
                border: outlined ? `1px solid ${tokens.rule}` : "none",
                fontFamily: mono, fontSize: "0.72rem", fontWeight: 600 }}>
          {unit}
        </Box>
      ))}
    </Stack>
  );
}

/**
 * How the game was set up, as one line.
 *
 * It belongs to the game and not to a side, which is why it is here rather
 * than inside `ArmyDetail`: both players were in the same deployment.
 */
export function setupLine(setup: {
  mission: string; deployment: string; terrain: string;
} | null | undefined): string {
  if (!setup) return "";
  return [
    setup.mission.trim(),
    deploymentLabel(setup.deployment),
    setup.terrain.trim(),
  ].filter(Boolean).join(" · ");
}
