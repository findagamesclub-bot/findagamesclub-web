"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Stack from "@mui/material/Stack";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import NavTabs from "@/components/ui/NavTabs";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useActionToast } from "@/components/ui/Toaster";
import { useActionSuccess } from "@/hooks/useActionSuccess";
import RoundTables from "./RoundTables";
import RoundTools from "./RoundTools";
import PasteDialog from "./PasteDialog";
import FixtureDialog from "./FixtureDialog";
import MatchDialog from "./MatchDialog";
import DrawAudience from "./DrawAudience";
import GameResultDialog, { type GameResultFields }
  from "@/components/results/GameResultDialog";
import type { MatchSetup } from "@/utils/result-meta";
import FixtureScoreDialog from "./FixtureScoreDialog";
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
  builder, lists, armies, setup, teamEvent, teams, fixtures,
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
  /** How each table was set up, by match id. One mission per game, not per side. */
  setup: Record<number, MatchSetup>;
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
  // The fixture a NEW table is going under at a team event, so a table added
  // by hand is never one that belongs to nothing. Null on an ordinary draw.
  const [underFixture, setUnderFixture] = useState<TeamFixture | null>(null);
  const [pairingTeams, setPairingTeams] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [removing, setRemoving] = useState<PairingMatch | null>(null);
  const [arming, setArming] = useState<PairingMatch | null>(null);
  const [droppingFixture, setDroppingFixture] = useState<TeamFixture | null>(null);
  const [scoringFixture, setScoringFixture] = useState<TeamFixture | null>(null);

  // Below the state it closes over, not beside the toast at the top: a hook
  // referencing a setter declared later is the temporal dead zone `BadgeBoard`
  // already paid for, and `react-hooks` is what caught it here.
  // Every dialog here closes when the answer lands, never on the click, so a
  // refusal keeps what was typed into it. The two added for item 21 go in the
  // same hook rather than closing themselves: only one is ever open.
  useActionSuccess(state, () => {
    setScoringFixture(null);
    setPairingTeams(false);
    setEditing(undefined);
    setUnderFixture(null);
    // The armies and match context dialog was the one left out of this list,
    // so it alone stayed open after a save: "the pop up does not auto close
    // on save". A list of things to close is a list with one missing.
    setArming(null);
  });

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
        onAdd={() => { setUnderFixture(null); setEditing(null); }}
        onAddFixture={() => setPairingTeams(true)}
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
              onRemoveFixture={(fixture) => setDroppingFixture(fixture)}
              onScoreFixture={(fixture) => setScoringFixture(fixture)}
              onAddTable={(fixture) => { setUnderFixture(fixture); setEditing(null); }} />
          ) : (
            <EmptyState
              title={`Round ${round} has not been drawn`}
              description={teams.length >= 2
                ? "Make the draw and the teams are shuffled against each other, with a table for each pair of players inside every fixture. Change any of them afterwards."
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

      <FixtureDialog open={pairingTeams} saving={busy} round={round} teams={teams}
        onClose={() => setPairingTeams(false)}
        onSave={(one, two) => send({ intent: "add-fixture",
          teamOne: String(one), teamTwo: String(two) })} />

      <PasteDialog open={pasting} saving={busy} round={round}
        onClose={() => setPasting(false)}
        onSave={(pasted) => { setPasting(false); send({ intent: "paste", pasted }); }} />

      {editing !== undefined ? (
        <MatchDialog open match={editing} roster={roster} round={round}
          position={editing?.position ?? (underFixture?.tables.length ?? matches.length)}
          nextTable={String((underFixture?.tables.length ?? matches.length) + 1)}
          fixtureName={underFixture
            ? `${underFixture.teamOneName} v ${underFixture.teamTwoName}`
            : ""}
          onClose={() => { setEditing(undefined); setUnderFixture(null); }}
          onSave={(fields) => {
            send({ intent: "save-match", ...fields,
                   teamMatchId: String(underFixture?.id ?? "") });
          }} />
      ) : null}

      <ScoresDialog open={scoring} saving={busy} round={round} teamEvent={asTeams}
        matches={shown as PairingMatch[]}
        onClose={() => setScoring(false)}
        onSave={(rows) => {
          setScoring(false);
          send({ intent: "save-scores" }, (data) => {
            for (const row of rows) {
              data.append("scoreMatchId", String(row.id));
              data.append("scoreOne", row.scoreOne);
              data.append("scoreTwo", row.scoreTwo);
              // Sent for every table, empty on an ordinary draw, so the
              // indexes stay lined up whichever kind of event this is.
              data.append("pointsOne", row.pointsOne);
              data.append("pointsTwo", row.pointsTwo);
            }
          });
        }} />

      {/* The same dialog a league round uses. It was this screen's own cut
          down version, offering three of the nine things `put_result_army`
          has taken since 0135 and none of the setup. */}
      <GameResultDialog
        game={arming ? {
          id: arming.id,
          playerOne: arming.playerOne, playerOneId: arming.playerOneId ?? null,
          playerTwo: arming.playerTwo, playerTwoId: arming.playerTwoId ?? null,
        } : null}
        title={arming ? (arming.tableLabel || `Table ${arming.position + 1}`) : ""}
        builder={builder} lists={lists}
        recorded={armies} setup={setup} saving={busy}
        onClose={() => setArming(null)}
        onSave={(fields: GameResultFields) => {
          send({ intent: "save-armies", matchId: String(arming?.id ?? 0), ...fields });
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

      {/* Closed on the answer landing, never on the click: a refusal here
          would otherwise take the typed figures with it and then explain why.
          Sixth time that has been written down. */}
      <FixtureScoreDialog
        fixture={scoringFixture}
        open={Boolean(scoringFixture)}
        busy={busy}
        onClose={() => setScoringFixture(null)}
        send={(data) => {
          data.set("slug", slug);
          data.set("eventId", String(eventId));
          data.set("round", String(round));
          data.set("pairingId", String(current?.id ?? 0));
          startTransition(() => submit(data));
        }}
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
