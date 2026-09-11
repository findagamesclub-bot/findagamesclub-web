"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { tokens } from "@/lib/tokens";

/**
 * The bin on a row of the listing editor, and the question that comes first.
 *
 * One component rather than six, so every row in the editor asks the same way
 * and says the same thing about when the change actually lands. A row nobody
 * has typed into goes without asking: a confirmation over an empty row is a
 * click that protects nothing.
 */
export default function RemoveRow({
  what, body, confirm = true, disabled = false, sx, onRemove,
}: {
  /** Lower case, as it reads in "Remove tier". */
  what: string;
  /** What will actually happen, not "are you sure". */
  body: React.ReactNode;
  confirm?: boolean;
  disabled?: boolean;
  /** Placement in whatever row it sits in. Centred unless told otherwise. */
  sx?: SxProps<Theme>;
  onRemove: () => void;
}) {
  const [asking, setAsking] = useState(false);

  return (
    <>
      <IconButton size="small" aria-label={`Remove ${what}`} disabled={disabled}
        onClick={() => (confirm ? setAsking(true) : onRemove())}
        sx={[{ alignSelf: "center", color: tokens.inkMuted,
               "&:hover": { color: tokens.danger } },
             ...(Array.isArray(sx) ? sx : [sx])]}>
        <DeleteIcon sx={{ fontSize: 18 }} />
      </IconButton>

      {/* Portalled, so it costs the row no track of its own. */}
      <ConfirmDialog open={asking} title={`Remove this ${what}?`} body={body}
        confirmLabel={`Remove ${what}`} destructive
        onConfirm={onRemove} onClose={() => setAsking(false)} />
    </>
  );
}
