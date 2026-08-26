"use client";

import { startTransition, useActionState } from "react";
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
  clubId, slug, personId, personName, rivalRowId, mutual, faction,
}: {
  clubId: number;
  slug: string;
  personId: string;
  personName: string;
  /** The row id when they are already a rival, null when they are not. */
  rivalRowId: number | null;
  mutual: boolean;
  faction: Faction;
}) {
  const [, submit, busy] = useActionState<RivalState, FormData>(rivalAction, {});

  const send = () => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("clubId", String(clubId));
    if (rivalRowId) {
      data.set("intent", "unmark");
      data.set("rivalRowId", String(rivalRowId));
    } else {
      data.set("intent", "mark");
      data.set("rivalId", personId);
      data.set("rivalName", personName);
    }
    startTransition(() => submit(data));
  };

  const marked = Boolean(rivalRowId);

  return (
    <Tooltip title={
      marked
        ? (mutual ? "You have both named each other" : `Stop counting ${personName} as a rival`)
        : `Count ${personName} as a rival`
    }>
      <span>
        <Button
          size="small"
          variant={marked ? "contained" : "outlined"}
          disabled={busy}
          onClick={send}
          startIcon={<SportsKabaddiIcon sx={{ fontSize: 16 }} />}
          sx={marked
            ? { backgroundColor: faction.base, "&:hover": { backgroundColor: faction.deep } }
            : { borderColor: tokens.rule, color: tokens.inkMuted,
                "&:hover": { borderColor: faction.base, color: faction.deep } }}
        >
          {marked ? (mutual ? "Rivals" : "Rival") : "Rival"}
        </Button>
      </span>
    </Tooltip>
  );
}
