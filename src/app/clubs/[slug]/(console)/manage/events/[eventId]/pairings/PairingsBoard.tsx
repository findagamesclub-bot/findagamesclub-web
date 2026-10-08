"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Stack from "@mui/material/Stack";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import NavTabs from "@/components/ui/NavTabs";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import RoundTables from "./RoundTables";
import RoundTools from "./RoundTools";
import PasteDialog from "./PasteDialog";
import MatchDialog from "./MatchDialog";
import DrawAudience from "./DrawAudience";
import ArmiesDialog, { type ArmyFields } from "./ArmiesDialog";
import TeamFixtures from "./TeamFixtures";
import ScoresDialog from "./ScoresDialog";
import { pairingsAction, type PairingsState } from "./actions";
import { nextSearch, withSearch } from "@/utils/filter-url";
import { type Faction } from "@/lib/tokens";
import type { PairingMatch, PairingRound } from "@/types/eventEditor";
import { roundTabs, type Player } from "@/utils/pairings-draw";
import type { Builder, MemberList } from "@/services/resultArmies.service";
import type { PairingArmy } from "@/services/eventPairingArmies.service";
import type { EventTeam, TeamFixture } from "@/types/eventTeams";

/**
 * Every round of an event, one tab each.
 *
 * A tournament organiser has ten minutes between rounds, so the three ways of
 * filling a round are on the round itself rather than behind a menu, and the
 * scores go in one dialog for the whole round rather than one per table.
 */
export default function PairingsBoard({
  slug, eventId, rounds, roster, roundCount, faction, showing, drawPublic,
  builder, lists, armies, teamEvent, teams, fixtures,
}: {
  slug: string;
  eventId: number;
  rounds: PairingRound[];
  roster: Player[];
  roundCount: number | null;
  faction: Faction;
  showing?: number;
  /** Whether a round on show reaches the street or only the people coming. */
  drawPublic: boolean;
  /** Null at a club that does not record armies, which hides all of that. */
  builder: Builder | null;
  /** Lists built at this club, narrowed per side by the dialog. */
  lists: MemberList[];
  /** What is already recorded, keyed `<matchId>:<side>`. */
  armies: Record<string, PairingArmy>;
  /**
   * The switch on the Teams page, and the only answer to the question. Turning
   * it off really does put this page back to one player per table: a fixture's
   * tables are ordinary tables either way, so they are still here and still
   * scored, they just stop being grouped.
   */
  teamEvent: boolean;
  teams: EventTeam[];
  /** Every fixture on the event, narrowed to the open round here. */
  fixtures: TeamFixture[];
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
  const [arming, setArming] = useState<PairingMatch | null>(null);
  const [droppingFixture, setDroppingFixture] = useState<TeamFixture | null>(null);

  const asTeams = teamEvent;

  const current = useMemo(
    () => rounds.find((r) => r.round === round) ?? null, [rounds, round]);

  const roundFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.round === round),
    [fixtures, round]);

  const tabs = useMemo(() => roundTabs(rounds, roundCount), [rounds, roundCount]);

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

  // At a team event the tables that count are the ones under a fixture. The
  // round's flat list can still hold tables from an individual draw made
  // before the event was switched over, and counting those said "2 tables, 2
  // played" directly above "Round 2 has not been drawn". Drawing the round
  // clears them, so this is only ever wrong in the window before that, which
  // is exactly the window somebody is looking at it.
  const shown = asTeams ? roundFixtures.flatMap((fixture) => fixture.tables) : matches;
  const played = shown.filter((m) => m.scoreOne !== null || m.scoreTwo !== null).length;

  // A round switched to teams still holds whatever the individual draw put
  // there, and drawing clears the round outright. Without this the first press
  // after switching an event over would take eight scored tables with it and
  // say nothing: the counter reads zero because none of them is under a
  // fixture, so there would have been nothing on screen to warn about.
  const leftovers = asTeams && !shown.length && matches.length > 0;

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
        round={round} tables={shown.length} played={played}
        roster={roster.length} busy={busy} drawPublic={drawPublic}
        teams={asTeams ? teams.length : null}
        published={current?.published ?? null}
        onPublish={(on) => send({ intent: "publish", published: on ? "yes" : "no" })}
        onDraw={() => (shown.length || leftovers
          ? setClearing(true)
          : send({ intent: asTeams ? "generate-teams" : "generate" }))}
        onPaste={() => setPasting(true)}
        onAdd={() => setEditing(null)}
        onScores={() => setScoring(true)}
      />

      <BusyOverlay busy={busy} variant="dim" label="Saving">
        {asTeams ? (
          roundFixtures.length ? (
            <TeamFixtures fixtures={roundFixtures} busy={busy}
              armies={armies} recordsArmies={builder !== null}
              onEdit={(match) => setEditing(match)}
              onArmies={(match) => setArming(match)}
              onRemove={(match) => setRemoving(match)}
              onRemoveFixture={(fixture) => setDroppingFixture(fixture)} />
          ) : (
            <EmptyState
              title={`Round ${round} has not been drawn`}
              description={teams.length >= 2
                ? "Make the draw and the teams are shuffled against each other, with a table for board one, board two and so on inside every fixture."
                : "You need at least two teams before a round can be drawn. Build them on the Teams page."}
            />
          )
        ) : matches.length ? (
          <RoundTables matches={matches} busy={busy}
            armies={armies} recordsArmies={builder !== null}
            onEdit={(match) => setEditing(match)}
            onArmies={(match) => setArming(match)}
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

      <ScoresDialog open={scoring} saving={busy} round={round}
        matches={shown as PairingMatch[]}
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

      <ArmiesDialog match={arming} builder={builder} lists={lists}
        recorded={armies} saving={busy}
        onClose={() => setArming(null)}
        onSave={(fields: ArmyFields) => {
          setArming(null);
          send({ intent: "save-armies", ...fields });
        }} />

      <ConfirmDialog
        open={clearing}
        title={leftovers
          ? `Replace the round ${round} draw with a team draw?`
          : `Make the round ${round} draw again?`}
        body={leftovers
          ? `Round ${round} was drawn one player per table before this event ran as teams. Those ${matches.length} tables, and any scores on them, are replaced by a team draw.`
          : asTeams
            ? "The teams are shuffled against each other again and fresh tables made inside every fixture. The fixtures you have now, and any scores on their tables, are replaced."
            : "Everybody coming is shuffled and put on a fresh table. The tables you have now, and any scores on them, are replaced."}
        confirmLabel={leftovers ? "Replace it" : "Make it again"} destructive
        onConfirm={() => {
          setClearing(false);
          send({ intent: asTeams ? "generate-teams" : "generate" });
        }}
        onClose={() => setClearing(false)}
      />

      <ConfirmDialog
        open={Boolean(droppingFixture)}
        title="Remove this fixture?"
        body={droppingFixture
          ? `${droppingFixture.teamOneName} against ${droppingFixture.teamTwoName || "nobody"} comes off the draw, along with every table under it and any score on those.`
          : ""}
        confirmLabel="Remove fixture" destructive busy={busy}
        onConfirm={() => {
          if (droppingFixture) {
            send({ intent: "remove-fixture", fixtureId: String(droppingFixture.id) });
          }
          setDroppingFixture(null);
        }}
        onClose={() => setDroppingFixture(null)}
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

      <DrawAudience open={drawPublic} busy={busy}
        onChange={(open) =>
          send({ intent: "draw-audience", drawPublic: open ? "yes" : "no" })} />
    </Stack>
  );
}
