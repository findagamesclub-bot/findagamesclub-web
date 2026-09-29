"use client";

import { startTransition, useActionState, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useActionToast } from "@/components/ui/Toaster";
import { competitionAction, type CompetitionState }
  from "@/app/clubs/[slug]/(console)/competitions/actions";
import StandingRowFields from "./StandingRowFields";
import { useCatalogue } from "@/hooks/useCatalogue";
import type { Builder } from "@/services/resultArmies.service";
import { mono, tokens, type Faction } from "@/lib/tokens";
import type { CompetitionStanding } from "@/types/competition";

export type StandingRow = {
  key: string;
  memberName: string;
  profileId: string | null;
  wins: number; draws: number; losses: number; points: number;
  faction: string;
  detachment: string;
  disposition: string;
  notes: string;
};

/**
 * The league table, edited as a whole.
 *
 * Rank and played are not fields. Rank is a position in the sorted table and
 * played is wins plus draws plus losses, so asking a club to keep either in its
 * head is asking it to make them wrong. Both are computed on save.
 */
export default function StandingsEditor({
  competitionId, slug, faction, standings, roster, builder = null,
}: {
  competitionId: number;
  slug: string;
  faction: Faction;
  standings: CompetitionStanding[];
  /** Members who hold an account here, so a row can be linked to a profile. */
  roster: { id: string; name: string }[];
  /**
   * The catalogue this club records against, or null when it does not run the
   * army builder. Null is the old behaviour: one free-text Army box.
   */
  builder?: Builder | null;
}) {
  const [state, submit, busy] = useActionState<CompetitionState, FormData>(
    competitionAction, {});
  useActionToast(state);

  // A new row opens; existing ones stay shut. Somebody adding a player wants
  // the fields, somebody scanning a table of twenty does not.
  const [openRow, setOpenRow] = useState<string | null>(null);

  const [rows, setRows] = useState<StandingRow[]>(() => standings.map((s, i) => ({
    key: `existing-${i}`,
    memberName: s.memberName,
    profileId: s.profileId,
    wins: s.wins, draws: s.draws, losses: s.losses, points: s.points,
    faction: s.faction,
    detachment: s.detachment,
    disposition: s.disposition,
    notes: s.notes,
  })));

  // Fetched when a row is opened, not on the way into the page: the table is
  // read far more often than it is edited, and the catalogue is close to a
  // megabyte.
  const { catalogue, loading, failed } = useCatalogue(builder, openRow !== null);

  const patch = (key: string, change: Partial<StandingRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));

  const save = () => {
    const data = new FormData();
    data.set("intent", "standings");
    data.set("slug", slug);
    data.set("competitionId", String(competitionId));
    data.set("rows", JSON.stringify(rows.map((r) => ({
      memberName: r.memberName, profileId: r.profileId,
      wins: r.wins, draws: r.draws, losses: r.losses, points: r.points,
      notes: r.notes, faction: r.faction,
      // Named explicitly, like every other field. Leaving them out of this
      // list is how they were silently dropped: the row held them, the summary
      // line showed them, the toast said Saved, and the payload never carried
      // them.
      detachment: r.detachment, disposition: r.disposition,
    }))));
    startTransition(() => submit(data));
  };

  return (
    <Stack spacing={2}>
      {rows.length ? (
        <Stack spacing={1.25}>
          {rows.map((row, index) => (
            <Accordion key={row.key} disableGutters
              expanded={openRow === row.key}
              onChange={(_e, open) => setOpenRow(open ? row.key : null)}
              sx={{ border: `1px solid ${tokens.rule}`, borderRadius: 1.5,
                    backgroundColor: tokens.paper, boxShadow: "none",
                    "&::before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1.5}
                  sx={{ alignItems: "baseline", flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontFamily: mono, fontSize: "0.8rem", fontWeight: 700,
                                    color: tokens.inkMuted, minWidth: 22 }}>
                    {index + 1}
                  </Typography>
                  <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>
                    {row.memberName || "New player"}
                  </Typography>
                  <Typography noWrap sx={{ fontFamily: mono, fontSize: "0.68rem",
                                           color: tokens.inkMuted, ml: "auto" }}>
                    {[row.faction, row.detachment,
                      `${row.wins}-${row.draws}-${row.losses}`,
                      `${row.points} PTS`].filter(Boolean).join(" · ").toUpperCase()}
                  </Typography>
                </Stack>
              </AccordionSummary>

              <AccordionDetails>
                <StandingRowFields
                  row={row} roster={roster} patch={patch}
                  onRemove={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  builder={builder} catalogue={catalogue}
                  loading={loading} failed={failed}
                />
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Nobody in the table yet. Add the players and the standings appear on the
          club page.
        </Typography>
      )}

      <Stack direction="row" spacing={1.5}
        sx={{ alignItems: "center", flexWrap: "wrap", pt: 0.5 }}>
        <Button variant="outlined" startIcon={<AddIcon />} disabled={busy}
          onClick={() => {
            const key = `new-${Date.now()}`;
            setRows((prev) => [...prev, {
              key, memberName: "", profileId: null,
              wins: 0, draws: 0, losses: 0, points: 0,
              faction: "", detachment: "", disposition: "", notes: "",
            }]);
            setOpenRow(key);
          }}
          sx={{ color: tokens.ink, borderColor: tokens.rule }}>
          Add a player
        </Button>

        <Button variant="contained" loading={busy} loadingPosition="start" onClick={save}
          sx={{ bgcolor: faction.base, "&:hover": { bgcolor: faction.deep } }}>
          Save the table
        </Button>

        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          Ordered by points, then wins, then fewest losses.
        </Typography>
      </Stack>
    </Stack>
  );
}
