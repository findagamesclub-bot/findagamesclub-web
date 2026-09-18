"use client";

import { startTransition, useActionState, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CasinoIcon from "@mui/icons-material/Casino";
import ImageIcon from "@mui/icons-material/Image";
import PublicIcon from "@mui/icons-material/Public";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import Panel from "@/components/members/Panel";
import ChipListField from "@/components/members/ChipListField";
import PhotoEditor from "./PhotoEditor";
import RemoveRow from "@/components/ui/RemoveRow";
import SubmitButton from "@/components/ui/SubmitButton";
import StepTargetFields, { type StepTarget } from "./StepTarget";
import { useActionToast } from "@/components/ui/Toaster";
import { saveListingStepAction, type ListingState } from
  "@/app/clubs/[slug]/(console)/manage/listing/[step]/actions";
import { SOCIAL_NETWORKS, socialValue, type SocialLink } from "@/utils/social-links";
import type { ClubPhoto } from "@/hooks/useClubPhotos";
import { tokens } from "@/lib/tokens";

export type ContentValues = {
  games: string[];
  facilities: string[];
  paymentMethods: string[];
  socialLinks: SocialLink[];
  categories: { id: string; label: string }[];
  photos: ClubPhoto[];
};

/**
 * Step 2, which legacy calls Content: what you play, what you have, how you
 * take money, your photos, where else you are, and what the board is for.
 *
 * Three of the readiness checks live in the first panel, so it comes first and
 * says so.
 */
export default function ContentStep({
  target, clubId, values,
}: {
  target: StepTarget;
  /**
   * Null while the club does not exist yet. Photos live under the club's own
   * folder in Storage, and a listing being written has no folder to put them
   * in, so the picker waits until it is approved rather than uploading into a
   * place nothing can later delete from.
   */
  clubId: number | null;
  values: ContentValues;
}) {
  const [state, submit, saving] = useActionState<ListingState, FormData>(saveListingStepAction, {});
  useActionToast(state);

  /**
   * Submitted by hand rather than through the form's `action` prop.
   *
   * React 19 resets an uncontrolled form once its action has run. That is right
   * when the save worked and catastrophic when it did not: a refused save
   * emptied all thirteen fields and then said "some of that needs another look"
   * about work that was no longer on screen. Dispatching the action ourselves
   * keeps everything typed exactly where it was.
   *
   * The button is told it is busy for the same reason: `useFormStatus` only
   * reports on a form that submits through `action`.
   */
  const send = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };
  const [categories, setCategories] = useState(values.categories);

  return (
    <Box component="form" onSubmit={send}>
      <StepTargetFields target={target} step="content" />

      <Box sx={{ display: "grid", gap: 2.5, alignItems: "start",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
        <Stack spacing={2.5}>
          <Panel title="What people will find" icon={CasinoIcon}>
            <Stack spacing={2}>
              <ChipListField name="games" label="Games you play" value={values.games}
                placeholder="Add a game and press Enter"
                helperText="The ones somebody would come to you for." />
              <ChipListField name="facilities" label="What the venue has"
                value={values.facilities}
                placeholder="Add a facility and press Enter"
                helperText="Parking, a bar, step-free access, terrain." />
              <ChipListField name="paymentMethods" label="How people can pay"
                value={values.paymentMethods}
                placeholder="Add a payment method and press Enter"
                helperText="Cash, card, bank transfer." />
            </Stack>
          </Panel>

          <Panel title="Where else you are" icon={PublicIcon}>
            <Stack spacing={2}>
              {SOCIAL_NETWORKS.map((network) => (
                <TextField key={network} name={`social-${network}`} label={network}
                  defaultValue={socialValue(values.socialLinks, network)} fullWidth
                  placeholder="https://" />
              ))}
            </Stack>
          </Panel>
        </Stack>

        <Stack spacing={2.5}>
          <Panel title="Photos" icon={ImageIcon}>
            {clubId === null ? (
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Photos are added once your club is live. Everything else here is
                saved with your listing.
              </Typography>
            ) : (
              <PhotoEditor clubId={clubId} initial={values.photos} />
            )}
          </Panel>

          <Panel title="What the board is for" icon={ForumIcon}>
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
                Members file a thread under one of these. Renaming one moves the
                threads with it; one with threads in it cannot be removed.
              </Typography>

              {categories.map((category, index) => (
                <Stack key={category.id || `new-${index}`} direction="row" spacing={1}
                  sx={{ alignItems: "center" }}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <TextField size="small" fullWidth name="category" value={category.label}
                    onChange={(event) => setCategories((held) =>
                      held.map((c, i) => (i === index ? { ...c, label: event.target.value } : c)))}
                    slotProps={{ htmlInput: { "aria-label": `Category ${index + 1}` } }} />
                  <RemoveRow what="category"
                    confirm={Boolean(category.id || category.label.trim())}
                    body={<>
                      Members cannot file a thread under
                      {category.label.trim() ? ` "${category.label.trim()}"` : " it"} any
                      more. Nothing changes until you save, and one with threads in it
                      will be refused then.
                    </>}
                    onRemove={() =>
                      setCategories((held) => held.filter((_, i) => i !== index))} />
                </Stack>
              ))}

              <Button size="small" variant="outlined" startIcon={<AddIcon />}
                sx={{ alignSelf: "flex-start" }}
                onClick={() => setCategories((held) => [...held, { id: "", label: "" }])}>
                Add a category
              </Button>
            </Stack>
          </Panel>
        </Stack>
      </Box>

      <Stack direction="row" spacing={2}
        sx={{ mt: 3, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Saving publishes straight away. Members see this on your club page.
        </Typography>
        <SubmitButton label="Save changes" pendingLabel="Saving" pending={saving} />
      </Stack>
    </Box>
  );
}
