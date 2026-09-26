import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SubmitButton from "@/components/ui/SubmitButton";
import { tokens } from "@/lib/tokens";
import type { StepTarget } from "./StepTarget";

/**
 * The line and the button at the bottom of every builder step.
 *
 * It was written out four times, in the live club's words, and the builder
 * fills in two different things: a listing being written told somebody
 * "Saving publishes straight away. Members see this on your club page" when
 * there was no club, no page and no members to see it. `StepTarget` already
 * knows which it is, so this asks it once instead of four copies each having
 * to remember.
 */
export default function StepFooter({
  target, pending,
}: {
  target: StepTarget;
  pending: boolean;
}) {
  const live = target.kind === "club";

  return (
    <Stack direction="row" spacing={2}
      sx={{ mt: 3, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        {live
          ? "Saving publishes straight away. Members see this on your club page."
          : "Saved as you go, and nobody sees it yet. You send it to us from the last step."}
      </Typography>
      <SubmitButton label={live ? "Save changes" : "Save and carry on"}
        pendingLabel="Saving" pending={pending} />
    </Stack>
  );
}
