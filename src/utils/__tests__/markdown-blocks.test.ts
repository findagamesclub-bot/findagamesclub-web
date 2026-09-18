import assert from "node:assert/strict";

import { parseInline, parseMarkdown } from "../markdown-blocks";

// --- inline ---------------------------------------------------------------

{
  assert.deepEqual(parseInline("plain words"), [{ kind: "text", text: "plain words" }]);

  assert.deepEqual(parseInline("we **must** say"), [
    { kind: "text", text: "we " },
    { kind: "bold", text: "must" },
    { kind: "text", text: " say" },
  ]);

  assert.deepEqual(parseInline("email [us](mailto:hi@example.com) today"), [
    { kind: "text", text: "email " },
    { kind: "link", text: "us", href: "mailto:hi@example.com" },
    { kind: "text", text: " today" },
  ]);

  assert.deepEqual(parseInline("see [the rules](/terms-of-use)"), [
    { kind: "text", text: "see " },
    { kind: "link", text: "the rules", href: "/terms-of-use" },
  ]);
}

{
  // The one thing this parser must never pass on. An admin writes the text,
  // but "only an admin can write it" is exactly the assumption that makes a
  // stored scripting hole worth having.
  const spans = parseInline("[click](javascript:alert(1))");
  assert.equal(spans.every((s) => s.kind !== "link"), true, "no link was made");
  assert.equal(spans[0]!.kind, "text");

  const data = parseInline("[click](data:text/html,<script>)");
  assert.equal(data.every((s) => s.kind !== "link"), true);
}

// --- blocks ---------------------------------------------------------------

{
  const blocks = parseMarkdown([
    "# Terms of use",
    "",
    "These terms apply to everybody",
    "using the site.",
    "",
    "## Your account",
    "",
    "- Keep your password to yourself",
    "- Tell us if it is compromised",
    "",
    "1. First",
    "2. Second",
  ].join("\n"));

  assert.equal(blocks.length, 5);
  assert.deepEqual(blocks[0], { kind: "heading", level: 1, spans: [{ kind: "text", text: "Terms of use" }] });

  // Wrapped lines are one paragraph, the way markdown means them.
  assert.equal(blocks[1]!.kind, "paragraph");
  if (blocks[1]!.kind === "paragraph") {
    assert.equal(blocks[1]!.spans[0]!.kind === "text"
      && blocks[1]!.spans[0]!.text, "These terms apply to everybody using the site.");
  }

  assert.equal(blocks[2]!.kind, "heading");
  if (blocks[3]!.kind === "list") {
    assert.equal(blocks[3]!.ordered, false);
    assert.equal(blocks[3]!.items.length, 2);
  } else assert.fail("expected a bullet list");

  if (blocks[4]!.kind === "list") {
    assert.equal(blocks[4]!.ordered, true, "numbers make a numbered list");
  } else assert.fail("expected a numbered list");
}

{
  // A list that changes kind halfway is two lists, not one with a muddle.
  const blocks = parseMarkdown("- one\n1. two");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.kind === "list" && blocks[0]!.ordered, false);
  assert.equal(blocks[1]!.kind === "list" && blocks[1]!.ordered, true);
}

{
  // The honest empties. A settings row nobody has written yet must render as
  // nothing rather than as a paragraph of whitespace.
  assert.deepEqual(parseMarkdown(""), []);
  assert.deepEqual(parseMarkdown("   \n\n  "), []);
  assert.deepEqual(parseMarkdown(null as unknown as string), []);
}

{
  // Windows line endings, because this text is pasted from a document.
  const blocks = parseMarkdown("# Heading\r\n\r\nA paragraph.\r\n");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.kind, "heading");
}


{
  // A link we will not follow keeps its words and loses its syntax. Pushing the
  // raw match put "[Do not click me](javascript:alert(1))" on a public page.
  const spans = parseInline("[Do not click me](javascript:alert(1))");
  const text = spans.map((s) => s.text).join("");
  assert.doesNotMatch(text, /javascript/i);
  assert.doesNotMatch(text, /\[|\]/);
  assert.match(text, /Do not click me/);
  assert.equal(spans.some((s) => s.kind === "link"), false);

  // An ordinary unsafe scheme leaves the words and nothing else.
  assert.equal(
    parseInline("[Old server](ftp://example.com)").map((s) => s.text).join(""),
    "Old server");

  // And the safe ones are untouched.
  assert.equal(
    parseInline("[Rules](https://example.com) and [us](mailto:a@b.co)")
      .filter((s) => s.kind === "link").length,
    2);
}

console.log("markdown-blocks: all assertions passed");