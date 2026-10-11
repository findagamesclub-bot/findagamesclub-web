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
  value, recorded, options, onChange, disabled = false, revealsArmy,
  hasArmy = false, hasSetup = false,
}: {
  value: string;
  /**
   * The game as it is stored, so the warning can tell a change from an open.
   *
   * Without it the warning fired the moment a dialog opened on any result
   * whose stored game is not 40k but which carries 40k detail from before
   * that rule existed. On a settled result, where the field is disabled and
   * Save is off, it was warning about a save nobody could make.
   */
  recorded: string;
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
  /**
   * Whether a mission, deployment or terrain is recorded on this result.
   *
   * Cleared by the same move for the same reason, and unlike the army half it
   * does not depend on the club recording armies: the setup fields are 40k's
   * own and go whatever the club has switched on.
   */
  hasSetup?: boolean;
}) {
  const named = canonicalGame(value);
  // Only once the game has actually moved. "Saving now also clears" is about
  // a change somebody just made, not about data that was already like that.
  const moved = named !== canonicalGame(recorded);
  const off = moved && named !== "Warhammer 40,000";
  const losesArmy = off && revealsArmy && hasArmy;
  const losesSetup = off && hasSetup;
  const clears = losesArmy || losesSetup;

  // Named rather than lumped together, because a club reading this has to know
  // what it is about to lose. "Details" would be a word for both and a warning
  // about neither.
  const going = losesArmy && losesSetup
    ? "the armies and the mission, deployment and terrain"
    : losesArmy
      ? "the armies"
      : "the mission, deployment and terrain";

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
            ? `Saving now also clears ${going} recorded on this result. Put the game back to Warhammer 40,000 to keep them.`
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
