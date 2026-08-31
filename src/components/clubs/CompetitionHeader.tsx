"use client";

import { startTransition, useActionState, useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/EditOutlined";
import CompetitionForm from "./CompetitionForm";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { competitionAction, type CompetitionState }
  from "@/app/clubs/[slug]/competitions/actions";
import { tokens, type Faction } from "@/lib/tokens";
import type { ManagedCompetition } from "@/services/competitions.service";

/** What this competition is, and the two things you can do to it as a whole. */
export default function CompetitionHeader({
  clubId, slug, faction, competition,
}: {
  clubId: number;
  slug: string;
  faction: Faction;
  competition: ManagedCompetition;
}) {
  const [state, submit, busy] = useActionState<CompetitionState, FormData>(
    competitionAction, {});
  useActionToast(state);
  const [editing, setEditing] = useState(false);
  const [dropping, setDropping] = useState(false);

  const remove = () => {
    const data = new FormData();
    data.set("intent", "delete");
    data.set("slug", slug);
    data.set("competitionId", String(competition.id));
    startTransition(() => submit(data));
    setDropping(false);
  };

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      {competition.summary ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          {competition.summary}
        </Typography>
      ) : null}

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Button size="small" variant="outlined" startIcon={<EditIcon />}
          onClick={() => setEditing(true)} disabled={busy}
          sx={{ color: tokens.ink, borderColor: tokens.rule }}>
          Edit the details
        </Button>

        <Button size="small" variant="text" onClick={() => setDropping(true)} disabled={busy}
          sx={{ ml: "auto", color: tokens.inkMuted,
                "&:hover": { color: tokens.danger, backgroundColor: "transparent" } }}>
          Delete
        </Button>
      </Stack>

      <CompetitionForm clubId={clubId} slug={slug} faction={faction}
        competition={competition} open={editing} onClose={() => setEditing(false)} />

      <ConfirmDialog
        open={dropping}
        title="Delete this competition?"
        body={`"${competition.title}", its table of ${competition.standings.length} `
          + `and all ${competition.updates.length} rounds will be removed from the club `
          + "page. Nothing else about the members changes."}
        confirmLabel="Delete it"
        cancelLabel="Keep it"
        destructive
        busy={busy}
        onConfirm={remove}
        onClose={() => setDropping(false)}
      />
    </Stack>
  );
}
