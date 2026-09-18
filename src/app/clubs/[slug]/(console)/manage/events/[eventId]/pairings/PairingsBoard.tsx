"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import NavTabs from "@/components/ui/NavTabs";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import RoundTables from "./RoundTables";
import RoundTools from "./RoundTools";
import PasteDialog from "./PasteDialog";
import MatchDialog from "./MatchDialog";
import ScoresDialog from "./ScoresDialog";
import { pairingsAction, type PairingsState } from "./actions";
import { nextSearch, withSearch } from "@/utils/filter-url";
import { tokens, type Faction } from "@/lib/tokens";
import type { PairingMatch, PairingRound } from "@/types/eventEditor";
import type { Player } from "@/utils/pairings-draw";

/**
 * Every round of an event, one tab each.
 *
 * A tournament organiser has ten minutes between rounds, so the three ways of
 * filling a round are on the round itself rather than behind a menu, and the
 * scores go in one dialog for the whole round rather than one per table.
 */
export default function PairingsBoard({
  slug, eventId, rounds, roster, roundCount, faction, showing,
}: {
  slug: string;
  eventId: number;
  rounds: PairingRound[];
  roster: Player[];
  roundCount: number | null;
  faction: Faction;
  showing?: number;
}) {
  const [state, submit, busy] = useActionState<PairingsState, FormData>(pairingsAction, {});
  useActionToast(state);

  // Built on the address as it stands, so the `from` trail survives a round
  // tab. Writing `?round=2` by hand replaced the whole query and left the back
  // link pointing at the editor rather than where the reader came from.
  const address = useSearchParams();
  const roundHref = (n: number) => withSearch("", nextSearch(address, { round: String(n) }));

  // The round being looked at comes from the URL, the way every other tab row
  // in the app works: a round is a real address, so it can be shared with
  // whoever is running the other half of the hall and opened on their phone.
  // Without one, the newest round that exists.
  const round = showing ?? rounds[rounds.length - 1]?.round ?? 1;
  const [pasting, setPasting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [editing, setEditing] = useState<PairingMatch | null | undefined>(undefined);
  const [clearing, setClearing] = useState(false);
  const [removing, setRemoving] = useState<PairingMatch | null>(null);

  const current = useMemo(
    () => rounds.find((r) => r.round === round) ?? null, [rounds, round]);

  // Rounds that exist, plus the next one to build. An event that says it has
  // five rounds offers all five, because a club drawing round four before
  // round three has finished is ordinary.
  const tabs = useMemo(() => {
    const known = rounds.map((r) => r.round);
    const upTo = roundCount && roundCount > 0
      ? roundCount
      : Math.max(...known, 0) + 1;
    const all = new Set<number>([...known]);
    for (let n = 1; n <= Math.max(upTo, 1); n++) all.add(n);
    return [...all].sort((a, b) => a - b);
  }, [rounds, roundCount]);

  const send = (fields: Record<string, string>, extra?: (data: FormData) => void) => {
    const data = new FormData();
    data.set("slug", slug);
    data.set("eventId", String(eventId));
    data.set("round", String(round));
    data.set("pairingId", String(current?.id ?? 0));
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    extra?.(data);
    startTransition(() => submit(data));
  };

  const matches = current?.matches ?? [];
  const played = matches.filter((m) => m.scoreOne !== null || m.scoreTwo !== null).length;

  return (
    <Stack spacing={2.5}>
      <NavTabs
        ariaLabel="Rounds"
        value={String(round)}
        accent={faction.base}
        // No count on these: "Round 1" followed by a muted 3 reads as
        // "Round 13". The strip underneath says how many tables the round has,
        // where it has room to say what the number means.
        tabs={tabs.map((n) => ({
          value: String(n),
          label: `Round ${n}`,
          href: roundHref(n),
        }))}
      />

      <RoundTools
        round={round} tables={matches.length} played={played}
        roster={roster.length} busy={busy}
        published={current?.published ?? null}
        onPublish={(on) => send({ intent: "publish", published: on ? "yes" : "no" })}
        onDraw={() => (matches.length ? setClearing(true) : send({ intent: "generate" }))}
        onPaste={() => setPasting(true)}
        onAdd={() => setEditing(null)}
        onScores={() => setScoring(true)}
      />

      <BusyOverlay busy={busy} variant="dim" label="Saving">
        {matches.length ? (
          <RoundTables matches={matches} busy={busy}
            onEdit={(match) => setEditing(match)}
            onRemove={(match) => setRemoving(match)} />
        ) : (
          <EmptyState
            title={`Round ${round} has not been drawn`}
            description={roster.length >= 2
              ? "Make the draw and everybody coming is shuffled onto a table, two at a time. Or paste a draw out of a spreadsheet, or add the tables yourself."
              : "Nobody has booked yet, so there is nobody to pair. You can still add tables by hand."}
          />
        )}
      </BusyOverlay>

      <PasteDialog open={pasting} saving={busy} round={round}
        onClose={() => setPasting(false)}
        onSave={(pasted) => { setPasting(false); send({ intent: "paste", pasted }); }} />

      {editing !== undefined ? (
        <MatchDialog open match={editing} roster={roster} round={round}
          position={editing?.position ?? matches.length}
          nextTable={String(matches.length + 1)}
          onClose={() => setEditing(undefined)}
          onSave={(fields) => {
            setEditing(undefined);
            send({ intent: "save-match", ...fields });
          }} />
      ) : null}

      <ScoresDialog open={scoring} saving={busy} round={round} matches={matches}
        onClose={() => setScoring(false)}
        onSave={(rows) => {
          setScoring(false);
          send({ intent: "save-scores" }, (data) => {
            for (const row of rows) {
              data.append("scoreMatchId", String(row.id));
              data.append("scoreOne", row.scoreOne);
              data.append("scoreTwo", row.scoreTwo);
            }
          });
        }} />

      <ConfirmDialog
        open={clearing}
        title={`Make the round ${round} draw again?`}
        body="Everybody coming is shuffled and put on a fresh table. The tables you have now, and any scores on them, are replaced."
        confirmLabel="Make it again" destructive
        onConfirm={() => { setClearing(false); send({ intent: "generate" }); }}
        onClose={() => setClearing(false)}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this table?"
        body={removing
          ? `${removing.playerOne}${removing.playerTwo ? ` against ${removing.playerTwo}` : ""} comes off the draw, along with any score on it.`
          : ""}
        confirmLabel="Remove table" destructive
        onConfirm={() => {
          if (removing) send({ intent: "remove-match", matchId: String(removing.id) });
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />

      <Box sx={{ pt: 1 }}>
        <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
          A draw stays hidden until you switch it on. Once the event has finished it is public
          either way, the same as the standings.
        </Typography>
      </Box>
    </Stack>
  );
}
