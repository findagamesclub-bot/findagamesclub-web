import assert from "node:assert/strict";
import { redact, redactText } from "../ai-redact";
import { pruneUnknownUnits } from "../ai-prune";
import { costPence } from "../ai-cost";

// ---------------------------------------------------------------- redaction
{
  assert.equal(redactText("mail me at sara@example.co.uk please"),
    "mail me at [email] please");
  assert.equal(redactText("we play at OX11 9AT"), "we play at [postcode]");
  assert.equal(redactText("ring 07700 900123"), "ring [phone]");

  // Names stay. A scouting pack that says "your opponent" four times is a
  // briefing nobody reads, and that is a decision rather than a miss.
  assert.equal(redactText("Joe Matthews brought Custodes"),
    "Joe Matthews brought Custodes");

  // Through a whole payload, at every depth, keys included.
  const out = redact({
    player: "Joe", contact: "joe@example.com",
    games: [{ note: "met at OX11 9AT" }],
    points: 2000, painted: true, missing: null,
  });
  assert.deepEqual(out, {
    player: "Joe", contact: "[email]",
    games: [{ note: "met at [postcode]" }],
    points: 2000, painted: true, missing: null,
  });
}

// ------------------------------------------------- units it made up
{
  const known = ["Castigator", "Battle Sisters Squad", "Exorcist"];
  const answer = {
    overview: "fine",
    unitChangeSuggestions: [
      { unitName: "Castigator", title: "Add one", detail: "..." },
      { unitName: "castigator", title: "Case does not matter", detail: "..." },
      { unitName: "Imperial Thunderhawk", title: "Invented", detail: "..." },
      { title: "No unit named at all", detail: "..." },
    ],
  };

  const { json, dropped } = pruneUnknownUnits(answer, known);
  const kept = (json as typeof answer).unitChangeSuggestions;
  assert.equal(kept.length, 3, "the two real ones and the unnamed one stay");
  assert.deepEqual(dropped, ["Imperial Thunderhawk"]);

  // Nothing to check against means nothing is dropped: an empty catalogue
  // must not silently delete every suggestion.
  assert.deepEqual(pruneUnknownUnits(answer, []).dropped, []);
  // A shape with no suggestions at all is left exactly as it was.
  assert.deepEqual(pruneUnknownUnits({ overview: "x" }, known).json, { overview: "x" });
  assert.deepEqual(pruneUnknownUnits(null, known).json, null);
}

// -------------------------------------------------------------- the cost
{
  // A small run is about a penny: 1,000 in at £3/M plus 500 out at £15/M is
  // £0.0105. Pinned, because the cap is arithmetic over this table and a
  // table that drifts does not fail loudly, it just stops a club at the wrong
  // point.
  assert.equal(costPence("claude-sonnet-5", { in: 1000, out: 500, cached: 0 }), 1.05);
  // A realistic coach run, with the faction list in the prompt.
  assert.equal(costPence("claude-sonnet-5", { in: 12000, out: 2000, cached: 0 }), 6.6);
  // Four decimal places, so a run is never rounded away to nothing.
  assert.equal(costPence("claude-sonnet-5", { in: 1, out: 0, cached: 0 }), 0.0003);

  // Cached input is an order of magnitude cheaper, which is why the faction's
  // unit list goes in its own cache block.
  const cached = costPence("claude-sonnet-5", { in: 0, out: 0, cached: 1000 });
  const fresh = costPence("claude-sonnet-5", { in: 1000, out: 0, cached: 0 });
  assert.ok(cached < fresh);

  // A model with no price recorded bills nothing rather than guessing.
  assert.equal(costPence("some-new-model", { in: 9e6, out: 9e6, cached: 0 }), 0);
}

console.log("ai-safety: all pass");
