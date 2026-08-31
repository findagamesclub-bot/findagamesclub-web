"use client";

import { useActionState, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useActionToast } from "@/components/ui/Toaster";
import { acceptSuggestionsAction, linkPersonAction, type LinkState }
  from "@/app/clubs/[slug]/results/actions";
import { display, mono, tokens, type Faction } from "@/lib/tokens";
import type { UnlinkedPerson } from "@/services/memberRecords.service";

type Member = { id: string; name: string };

/** Rows listed before a person's block folds the rest away. */
const SHOW_ROWS = 3;

/**
 * One recorded name, and the member it belongs to.
 *
 * Grouped rather than a row per result: legacy's editor asks for the player
 * once per standing, which means the same person is typed out again and again.
 * A club with three years of leagues has one member in fifty rows.
 *
 * Picked, never guessed. Legacy matches on the name string, so "Joe matthews"
 * silently links to nobody and two members called Joe link to whichever was
 * found first. The club is never told which happened.
 */
function PersonBlock({
  person, roster, slug, faction, suggestion,
}: {
  person: UnlinkedPerson;
  roster: Member[];
  slug: string;
  faction: Faction;
  suggestion: Member | null;
}) {
  const [state, submit, busy] = useActionState<LinkState, FormData>(linkPersonAction, {});
  useActionToast(state);
  const [picked, setPicked] = useState<Member | null>(suggestion);
  const [expanded, setExpanded] = useState(false);

  const shown = expanded ? person.rows : person.rows.slice(0, SHOW_ROWS);
  const hidden = person.rows.length - shown.length;

  return (
    <Box component="form" action={submit}
      sx={{ px: 2.25, py: 2, borderTop: `1px solid ${tokens.rule}` }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="profileId" value={picked?.id ?? ""} />
      <input type="hidden" name="rows"
        value={person.rows.map((row) => `${row.kind}:${row.id}`).join(",")} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}
        sx={{ alignItems: { md: "center" }, mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: display, fontSize: "1.05rem", fontWeight: 700 }}>
            {person.name}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            {person.rows.length === 1
              ? "This name is on 1 result below."
              : `This name is on ${person.rows.length} results below. Matching attaches all of them.`}
          </Typography>
        </Box>

        <Autocomplete
          options={roster}
          value={picked}
          onChange={(_event, value) => setPicked(value)}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          sx={{ width: { xs: "100%", md: 250 } }}
          slotProps={{
            paper: {
              sx: { border: `1px solid ${tokens.rule}`,
                    boxShadow: "0 10px 30px rgba(16,27,45,0.18)" },
            },
          }}
          renderInput={(params) => (
            <TextField {...params} size="small" label="Which member" />
          )}
        />

        {/* Disabled with nothing picked: writing null is what these rows
            already hold, so the press would change nothing. */}
        {/* No number on the button. The picker chooses one person and the
            row already says how many results there are, so a second number
            here read as "match two people". */}
        <Button type="submit" size="small" variant="contained" loading={busy}
          disabled={!picked}
          sx={{ flexShrink: 0, minWidth: 96, bgcolor: faction.base,
                "&:hover": { bgcolor: faction.deep } }}>
          Match
        </Button>
      </Stack>

      {/* The rows stay readable. An owner about to attach twelve results to
          somebody should be able to see what they are. */}
      <Stack spacing={0.5} sx={{ pl: { md: 0.5 } }}>
        {shown.map((row) => (
          <Stack key={`${row.kind}-${row.id}`} direction="row" spacing={1}
            sx={{ alignItems: "baseline" }}>
            <Chip size="small" label={row.kind === "standing" ? "League" : "Event"}
              sx={{ height: 18, fontSize: "0.58rem", flexShrink: 0,
                    bgcolor: tokens.surface }} />
            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                              color: tokens.inkMuted }} noWrap>
              {`${row.context.toUpperCase()} · ${row.detail.toUpperCase()}`}
            </Typography>
          </Stack>
        ))}

        {hidden > 0 ? (
          <Button size="small" variant="text" onClick={() => setExpanded(true)}
            sx={{ alignSelf: "flex-start", minWidth: 0, px: 0.5,
                  fontSize: "0.75rem", color: tokens.inkMuted }}>
            {`Show ${hidden} more`}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}

/**
 * Say who the names in a club's results belong to.
 *
 * Everything imported from the old site carries a player's name and no
 * account, so none of it reaches a member's profile. One pass down this list
 * attaches the lot: league records, podium finishes and the badges off them.
 */
export default function ResultMatcher({
  people, roster, slug, faction,
}: {
  people: UnlinkedPerson[];
  roster: Member[];
  slug: string;
  faction: Faction;
}) {
  // An exact name match is offered as a starting point, the way legacy's
  // suggestion list does. The owner still presses the button.
  const byName = useMemo(() => {
    const map = new Map<string, Member>();
    for (const member of roster) map.set(member.name.trim().toLowerCase(), member);
    return map;
  }, [roster]);

  // Names that match a member exactly. The boring half of the job, and the
  // half a person should not have to press through one at a time.
  const suggested = useMemo(
    () => people
      .map((person) => ({
        person,
        member: byName.get(person.name.trim().toLowerCase()) ?? null,
      }))
      .filter((pair): pair is { person: UnlinkedPerson; member: Member } =>
        pair.member !== null),
    [people, byName],
  );

  const suggestedResults = suggested.reduce((n, pair) => n + pair.person.rows.length, 0);

  if (!people.length) return null;

  return (
    <Stack spacing={2}>
      {suggested.length ? (
        <AcceptAll pairs={suggested} results={suggestedResults} slug={slug} />
      ) : null}

    <Box sx={{ borderRadius: 2, overflow: "hidden",
               border: `1px solid ${tokens.rule}`, backgroundColor: tokens.paper }}>
      {people.map((person) => (
        <PersonBlock key={person.name.toLowerCase()} person={person} roster={roster}
          slug={slug} faction={faction}
          suggestion={byName.get(person.name.trim().toLowerCase()) ?? null} />
      ))}
    </Box>
    </Stack>
  );
}

/**
 * One press for every name that matches a member exactly.
 *
 * Still a person confirming, and still undoable, but the obvious cases stop
 * being forty separate presses. What it attaches is listed, so accepting is
 * not accepting something unseen.
 */
function AcceptAll({
  pairs, results, slug,
}: {
  pairs: { person: UnlinkedPerson; member: Member }[];
  results: number;
  slug: string;
}) {
  const [state, submit, busy] = useActionState<LinkState, FormData>(
    acceptSuggestionsAction, {});
  useActionToast(state);

  const groups = pairs
    .map((pair) =>
      `${pair.member.id}=${pair.person.rows.map((row) => `${row.kind}:${row.id}`).join(",")}`)
    .join(";");

  return (
    <Stack component="form" action={submit} direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{ px: 2.25, py: 1.75, borderRadius: 2, alignItems: { sm: "center" },
            border: `1px solid rgba(184,134,43,0.45)`, backgroundColor: tokens.brassSoft }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="groups" value={groups} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: display, fontWeight: 700, color: "#3f2e0b" }}>
          {pairs.length === 1
            ? "One name matches a member exactly"
            : `${pairs.length} names match a member exactly`}
        </Typography>
        <Typography variant="body2" sx={{ color: "#5c4310" }}>
          {`${pairs.map((pair) => pair.person.name).join(", ")} · ${results} ${results === 1 ? "result" : "results"}`}
        </Typography>
      </Box>

      <Button type="submit" variant="contained" loading={busy} sx={{ flexShrink: 0 }}>
        {pairs.length === 1 ? "Accept it" : `Accept all ${pairs.length}`}
      </Button>
    </Stack>
  );
}
