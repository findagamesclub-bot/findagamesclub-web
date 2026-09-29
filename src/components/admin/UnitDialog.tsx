"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import SubmitButton from "@/components/ui/SubmitButton";
import { scoreProblem } from "@/utils/result-army";
import { linePoints } from "@/utils/army-pricing";
import { mono, tokens } from "@/lib/tokens";
import type { UnitRow } from "@/services/armyCatalogue.service";

const pretty = (value: unknown) =>
  JSON.stringify(value ?? [], null, 2);

/**
 * One unit: its points, its options, and the rule for taking more than one.
 *
 * The copy costs are edited as JSON rather than as a builder, deliberately.
 * They are `[{ fromCopy, toCopy, options }]` straight out of the legacy file,
 * 39 units in 1409 carry them, and a form for a shape that rare would be more
 * to get wrong than to type. The preview underneath is what makes it safe:
 * it prices three copies live, so a rule that does not do what somebody meant
 * says so before it is saved.
 */
export default function UnitDialog({
  open, unit, busy, onSave, onClose,
}: {
  open: boolean;
  unit: UnitRow | null;
  busy: boolean;
  onSave: (fields: Record<string, string>) => void;
  onClose: () => void;
}) {
  const small = useMediaQuery("(max-width:599px)");
  const [name, setName] = useState("");
  const [points, setPoints] = useState("");
  const [options, setOptions] = useState("[]");
  const [rules, setRules] = useState("[]");
  const [shown, setShown] = useState<UnitRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setShown(unit);
    setName(unit?.name ?? "");
    setPoints(unit ? String(unit.base_points) : "");
    setOptions(pretty(unit?.options));
    setRules(pretty(unit?.copy_cost_rules));
  }, [open, unit]);

  // A points value that will not parse is not nought. `Number("")` being 0 is
  // how a listing price shipped as free in stage 5.
  const parsed = /^\d{1,5}$/.test(points.trim()) ? Number(points.trim()) : 0;
  const pointsError = points.trim() === ""
    ? "" : scoreProblem(points, 99999, "Points");

  let jsonError = "";
  let preview = "";
  try {
    const parsedOptions = JSON.parse(options || "[]");
    const parsedRules = JSON.parse(rules || "[]");
    if (parsed > 0) {
      const three = linePoints(
        { name, basePoints: parsed, options: parsedOptions, copyCostRules: parsedRules }, 3);
      preview = `Three of them cost ${three}`;
    }
  } catch {
    jsonError = "The options or the copy costs are not valid JSON.";
  }

  const blocked = !name.trim() || parsed <= 0 || Boolean(jsonError);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose}
      fullWidth maxWidth="sm" fullScreen={small}>
      <DialogTitle sx={{ fontSize: "1.1rem" }}>
        {shown ? "Edit unit" : "New unit"}
      </DialogTitle>
      <DialogContent>
        <Stack component="form" spacing={2.5} sx={{ pt: 1 }}
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              name: name.trim(), points: String(parsed),
              options, rules, position: String(shown?.position ?? 0),
            });
          }}>
          <TextField label="Name" value={name} required autoFocus
            onChange={(event) => setName(event.target.value.slice(0, 200))} />
          <TextField label="Points" value={points} required
            error={Boolean(pointsError)} helperText={pointsError || "What one costs."}
            onChange={(event) => setPoints(event.target.value.slice(0, 6))} />
          <TextField label="Options" value={options} multiline minRows={3}
            onChange={(event) => setOptions(event.target.value)}
            slotProps={{ htmlInput: { style: { fontFamily: mono, fontSize: "0.8rem" } } }}
            helperText="Legacy's own shape: label, modelCount and points." />
          <TextField label="Copy costs" value={rules} multiline minRows={3}
            error={Boolean(jsonError)}
            onChange={(event) => setRules(event.target.value)}
            slotProps={{ htmlInput: { style: { fontFamily: mono, fontSize: "0.8rem" } } }}
            helperText={jsonError
              || "fromCopy, toCopy and options. A null toCopy means every copy after."} />

          {preview ? (
            <Typography sx={{ fontFamily: mono, fontSize: "0.75rem",
                              color: tokens.brass, fontWeight: 700 }}>
              {preview}
            </Typography>
          ) : null}

          <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pb: 1 }}>
            <Button variant="text" onClick={onClose} disabled={busy}>Cancel</Button>
            <SubmitButton label={shown ? "Save changes" : "Add it"}
              pendingLabel="Saving the unit" variant="contained"
              blocked={blocked} pending={busy} />
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
