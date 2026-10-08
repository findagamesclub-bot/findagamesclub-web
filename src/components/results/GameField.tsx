"use client";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { canonicalGame } from "@/utils/game-label";
import { tokens } from "@/lib/tokens";

/**
 * Which game this was.
 *
 * The club's own listed games, and free text for anything else, because a
 * member who brought something the club has never listed still played it. The
 * value is what gets stored, so the folding stays where it already lives:
 * `canonicalGame` turns "warhammer 40k" and "Warhammer 40,000" into one
 * spelling at read time, and the member is not made to care which they typed.
 *
 * It sits above the army fields rather than beside the scores because it
 * decides whether those fields appear at all. A control that reveals another
 * control belongs in front of it.
 */
export default function GameField({
  value, options, onChange, disabled = false, revealsArmy, hasArmy = false,
}: {
  value: string;
  /** The games the club lists, in its own order. */
  options: string[];
  onChange: (game: string) => void;
  disabled?: boolean;
  /**
   * Whether picking 40k here would actually open the army fields. False at a
   * club that does not record armies, and then the helper text says nothing
   * about them rather than promising something that will not happen.
   */
  revealsArmy: boolean;
  /**
   * Whether an army is recorded on this result already.
   *
   * Moving the game off 40k takes the army fields away and the save then
   * clears what was recorded, because an empty army deletes its row. That is
   * the right behaviour and a silent one: a club correcting a mistyped game
   * on a 40k result would lose the faction, the detachment and the units
   * without being told. This is what makes it said out loud.
   */
  hasArmy?: boolean;
}) {
  const named = canonicalGame(value);
  const clears = revealsArmy && hasArmy && named !== "Warhammer 40,000";

  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      disabled={disabled}
      onInputChange={(_event, next) => onChange(next)}
      slotProps={{
        paper: {
          sx: { mt: 0.5, border: `1px solid ${tokens.rule}`,
                boxShadow: "0 10px 30px rgba(16,27,45,0.18)" },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Game"
          helperText={clears
            ? "Saving now also clears the armies recorded on this result. Put the game back to Warhammer 40,000 to keep them."
            : revealsArmy
              ? named === "Warhammer 40,000"
                ? "Faction, detachment and disposition are below."
                : "Pick Warhammer 40,000 to record factions and detachments."
              : "What was played. Pick from your club's games or type any other."}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...(params.slotProps?.htmlInput ?? {}), maxLength: 120 },
            // Danger, because this one is about to take something away. Every
            // other state of this helper is ordinary guidance.
            formHelperText: clears ? { sx: { color: tokens.danger } } : undefined,
          }}
        />
      )}
    />
  );
}
