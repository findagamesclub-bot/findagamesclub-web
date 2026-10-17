"use client";

import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { tokens } from "@/lib/tokens";
import type { MemberList } from "@/services/resultArmies.service";

/**
 * Which of somebody's saved lists they brought.
 *
 * The club picks it, which is a departure worth naming: `link_result_army_list`
 * is the member's own and refuses anybody else, because on a club night the
 * only person who knows which list came out of the bag is the person who built
 * it. A tournament is the case that rule was not written for, so 0163 gives
 * the club its own door for event results and this is what reaches it. It can
 * say which of that player's lists, never whose.
 *
 * Choosing one fills the faction and detachment in, because a list already
 * says both and typing them again is two chances to disagree with it.
 *
 * Says why it is empty rather than disappearing. A result typed against a
 * free-text name has no account and therefore no lists, and "nothing here"
 * reads as broken when the answer is "link them to a member first".
 *
 * Where that linking happens differs, so the caller says it. On a placing the
 * player picker is in the same dialog; on a table of the draw it is behind
 * Edit, and pointing somebody at a control that is not on their screen is the
 * kind of sentence that costs a round trip. An empty `unnamedNote` says
 * nothing at all, which is right where the field above has already said it.
 *
 * Both notes are captions, not body copy. They sit directly under a field
 * whose own helper text is 0.75rem, and at body scale they were the loudest
 * thing in the dialog: an instruction shouting over the control it is about.
 */
export default function ArmyListPicker({
  lists, value, playerNamed, unnamedNote, disabled = false, onChange,
  label = "Army list", emptyNote,
}: {
  /** Already narrowed to the person this side of the result is filed under. */
  lists: MemberList[];
  value: number | null;
  /** False when the name is free text, so there is no account to look under. */
  playerNamed: boolean;
  /** Where to go to link that name to a member. Empty says nothing. */
  unnamedNote: string;
  disabled?: boolean;
  onChange: (list: MemberList | null) => void;
  /**
   * Whose list this is, in the second person where it is the reader's own.
   *
   * The club's screens talk about a player; a member recording their own game
   * is the player, and "they have not built an army list at your club" about
   * yourself reads as the control being pointed at somebody else.
   */
  label?: string;
  emptyNote?: string;
}) {
  if (!playerNamed) {
    return unnamedNote ? (
      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        {unnamedNote}
      </Typography>
    ) : null;
  }

  if (lists.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: tokens.inkMuted }}>
        {emptyNote
          ?? "They have not built an army list at your club, so there is none to name."}
      </Typography>
    );
  }

  return (
    <TextField select fullWidth label={label} disabled={disabled}
      value={value === null ? "" : String(value)}
      onChange={(event) => {
        const next = event.target.value;
        onChange(next === "" ? null : lists.find((l) => String(l.id) === next) ?? null);
      }}
      helperText="Optional. The list is frozen as it is today, so editing it later does not rewrite this result.">
      <MenuItem value="">
        <Typography component="span" sx={{ color: tokens.inkMuted }}>
          No list named
        </Typography>
      </MenuItem>
      {lists.map((list) => (
        <MenuItem key={list.id} value={String(list.id)}>
          {[list.name, list.faction,
            list.points === null ? null : `${list.points} pts`,
            list.version === null ? null : `v${list.version}`]
            .filter(Boolean).join(" · ")}
        </MenuItem>
      ))}
    </TextField>
  );
}
