"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveRow from "@/components/ui/RemoveRow";
import MetalPlate from "@/components/ui/MetalPlate";
import TonePicker from "./TonePicker";
import {
  startsAtZero, tiersProblem, type TierDraft,
} from "@/utils/loyalty-tiers";
import { tokens } from "@/lib/tokens";

/**
 * The club's own points ladder.
 *
 * Every reader has used `club_loyalty_settings.tiers` since 0020 and nothing
 * could write it, so every club in the directory was quietly running on
 * Bronze-to-Legend. The editor seeds from those defaults rather than opening
 * empty, because that is what the club is already running.
 *
 * Each row leads with the plate the member will actually see. A ladder is the
 * one thing in this app where colour means rank, and an editor that hides what
 * it is editing behind the word "platinum" is how a club ends up never
 * touching it.
 */
export default function LoyaltyLadder({
  rows, onChange,
}: {
  rows: TierDraft[];
  onChange: (rows: TierDraft[]) => void;
}) {
  const set = (index: number, patch: Partial<TierDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const problem = tiersProblem(rows);
  const filled = rows.filter((row) => row.label.trim());

  return (
    <Stack spacing={2}>
      <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
        Members climb this with the points they have ever earned. Spending
        points never moves them back down.
      </Typography>

      {rows.map((row, index) => (
        <Stack key={index} spacing={1.5}
          sx={{ p: 1.75, borderRadius: 1.5, border: `1px solid ${tokens.rule}`,
                backgroundColor: tokens.paper }}>
          {/* Hidden fields rather than names on the visible boxes: the rewards
              box is multiline and the tone has no input of its own, so one
              place writing all four keeps the form and the state in step.
              Inside the card, not beside it: as separate children of a spaced
              Stack, six empty boxes drew a band of dead space above the first
              tier. A hidden input still takes a slot in a flex container. */}
          <input type="hidden" name="tierLabel" value={row.label} />
          <input type="hidden" name="tierPoints" value={row.points} />
          <input type="hidden" name="tierTone" value={row.tone} />
          <input type="hidden" name="tierRewards" value={row.rewards} />

          <Stack direction="row" spacing={1.5}
            sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
            <MetalPlate size="small" label={row.label.trim() || "Untitled tier"}
              tone={row.tone} points={Number(row.points) || 0} />
            <Box sx={{ flex: 1 }} />
            <RemoveRow what="tier"
              confirm={Boolean(row.label.trim() || row.rewards.trim())}
              body={<>
                {row.label.trim() ? `"${row.label.trim()}"` : "This tier"} comes off
                the ladder. Members who had reached it move to the rung below.
                No points are lost. Nothing changes until you save.
              </>}
              onRemove={() => onChange(rows.filter((_, i) => i !== index))} />
          </Stack>

          <Box sx={{ display: "grid", gap: 1.5, alignItems: "start",
                 gridTemplateColumns: {
                   xs: "minmax(0, 1fr)", sm: "minmax(0, 1.4fr) minmax(0, 0.8fr)" } }}>
            <TextField size="small" label="Name" value={row.label}
              onChange={(e) => set(index, { label: e.target.value })} />
            <TextField size="small" label="Points needed" value={row.points}
              inputMode="numeric"
              onChange={(e) => set(index, { points: e.target.value })}
              helperText={index === 0 ? "Lifetime points. 0 is the first rung." : " "} />
          </Box>

          <TonePicker value={row.tone} onChange={(tone) => set(index, { tone })} />

          <TextField size="small" fullWidth multiline minRows={2}
            label="What it gets them" value={row.rewards}
            onChange={(e) => set(index, { rewards: e.target.value })}
            placeholder={"A free table every month\n10% off club kit"}
            helperText="One per line. Members see these on the loyalty page." />
        </Stack>
      ))}

      {problem ? <Alert severity="warning">{problem}</Alert> : null}

      {/* Said rather than refused: a club is allowed to want a ladder that
          starts above nothing, it just means a brand new member is shown a
          rung they have not climbed to. */}
      {!problem && filled.length > 0 && !startsAtZero(rows) ? (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nothing starts at 0 points, so a member who has earned none is shown
          your lowest tier anyway. Add a rung at 0 if you would rather they
          started there.
        </Typography>
      ) : null}

      <Button size="small" variant="outlined" startIcon={<AddIcon />}
        sx={{ alignSelf: "flex-start" }}
        onClick={() => onChange([...rows, { label: "", points: "", tone: "", rewards: "" }])}>
        Add a tier
      </Button>
    </Stack>
  );
}
