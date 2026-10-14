"use client";

import { startTransition, useActionState } from "react";
import { useActionToast } from "@/components/ui/Toaster";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import SportsKabaddiIcon from "@mui/icons-material/SportsKabaddi";
import { rivalAction, type RivalState } from "@/app/clubs/[slug]/rival-actions";
import { tokens, type Faction } from "@/lib/tokens";

/**
 * Mark somebody as a rival, or stop.
 *
 * One-directional and needs no agreement, which is how legacy has it — naming
 * a rival is a thing you say about yourself, not a request you send them. When
 * both have named each other the roster says so.
 */
export default function RivalButton({
  clubId, slug, personId, personName, rivalRowId, mutual, faction, size = "small",
  tooltip = true,
}: {
  clubId: number;
  slug: string;
  personId: string;
  personName: string;
  /** The row id when they are already a rival, null when they are not. */
  rivalRowId: number | null;
  mutual: boolean;
  faction: Faction;
  /**
   * Small in a roster row, where it sits among other row controls. Medium on
   * a profile, where it stands beside two 44px buttons and a shorter one
   * would read as a different class of thing.
   */
  size?: "small" | "medium";
  /**
   * The hover text. On the roster it is the only explanation there is room
   * for; a caller with the words on the screen beside the button passes false,
   * because the same sentence twice is worse than once.
   */
  tooltip?: boolean;
}) {
  const [state, submit, busy] = useActionState<RivalState, FormData>(rivalAction, {});
  // Naming a rival changed a row and said nothing about it, so the only way to
  // know it worked was to look for the name somewhere else on the page.
  useActionToast(state);

  const send = () => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("clubId", String(clubId));
    // Sent on both intents, not just the mark: it is what tells the action
    // whose profile to refresh, and dropping a rivalry from a profile left the
    // button showing the state it had just undone.
    data.set("rivalId", personId);
    data.set("rivalName", personName);
    if (rivalRowId) {
      data.set("intent", "unmark");
      data.set("rivalRowId", String(rivalRowId));
    } else {
      data.set("intent", "mark");
    }
    startTransition(() => submit(data));
  };

  const marked = Boolean(rivalRowId);

  /*
   * Outlined in both states, tinted when it is on.
   *
   * It was contained when marked, which put a second solid faction-coloured
   * button directly beside the card's own primary on a member's profile, with
   * "Rivals" sitting next to "Joe's rivals": two different kinds of control
   * wearing one shape and nearly one set of words. A toggle is not a call to
   * action, and this reads as on at a glance without competing with one.
   */
  const button = (
    <Button
      size={size}
      variant="outlined"
      loading={busy}
      loadingPosition="start"
      onClick={send}
      startIcon={<SportsKabaddiIcon sx={{ fontSize: 16 }} />}
      aria-pressed={marked}
      sx={{
        ...(size === "medium" ? { minHeight: 44 } : {}),
        ...(marked
          ? { borderColor: faction.base, backgroundColor: faction.soft,
              color: faction.deep, fontWeight: 700,
              "&:hover": { borderColor: faction.deep, backgroundColor: faction.soft } }
          : { borderColor: tokens.rule, color: tokens.inkMuted,
              "&:hover": { borderColor: faction.base, color: faction.deep } }),
      }}
    >
      {marked ? (mutual ? "Rivals" : "Rival") : "Rival"}
    </Button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip title={
      marked
        ? (mutual ? "You have both named each other" : `Stop counting ${personName} as a rival`)
        : `Count ${personName} as a rival`
    }>
      {/* A span, because a disabled button fires no events and the tooltip
          would never open. */}
      <span>{button}</span>
    </Tooltip>
  );
}
