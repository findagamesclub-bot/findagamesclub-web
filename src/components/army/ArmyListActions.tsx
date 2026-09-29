"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LinkButton from "@/components/ui/LinkButton";
import { useActionToast } from "@/components/ui/Toaster";
import { deleteArmyList } from "@/app/clubs/[slug]/(console)/army-builder/actions";

/**
 * What you can do to a whole list: read its history, or end it.
 *
 * Deleting is soft, so a result that named one of its versions still has one
 * to name. That is why the confirmation says the games keep it rather than
 * promising it is gone: telling somebody their data is destroyed when it is
 * not is the wrong kind of reassurance.
 *
 * Order follows the house rule: the quiet control first, and the one that
 * ends something last and as text.
 */
export default function ArmyListActions({
  slug, listId, versions, canEdit,
}: {
  slug: string;
  listId: number;
  versions: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, startDeleting] = useTransition();
  const [state, setState] = useState<{ error?: string; notice?: string }>({});
  const [asking, setAsking] = useState(false);
  useActionToast(state);

  const remove = () => startDeleting(async () => {
    const answer = await deleteArmyList(slug, listId);
    setState(answer);
    if (!answer.error) {
      setAsking(false);
      router.replace(`/clubs/${slug}/army-builder`);
    }
  });

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
      {canEdit ? (
        <>
          <LinkButton variant="contained"
            href={`/clubs/${slug}/army-builder/${listId}/edit`}>
            Edit list
          </LinkButton>
          <LinkButton variant="outlined"
            href={`/clubs/${slug}/army-builder/${listId}/matchup`}>
            Match-up
          </LinkButton>
          <LinkButton variant="outlined"
            href={`/clubs/${slug}/army-builder/${listId}/scout`}>
            Scout
          </LinkButton>
        </>
      ) : null}
      <LinkButton variant="outlined"
        href={`/clubs/${slug}/army-builder/${listId}/versions`}>
        {`History (${versions})`}
      </LinkButton>

      {canEdit ? (
        <Button variant="text" color="error" onClick={() => setAsking(true)}>
          Delete
        </Button>
      ) : null}

      <ConfirmDialog
        open={asking}
        title="Delete this list?"
        body="It comes off your shelf and your clubmates stop seeing it. Any game you linked it to keeps what you brought, so no result loses its army."
        confirmLabel="Delete it"
        destructive
        busy={busy}
        onClose={() => setAsking(false)}
        onConfirm={remove} />
    </Stack>
  );
}
