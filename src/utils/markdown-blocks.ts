/**
 * The small amount of markdown legal text actually uses.
 *
 * Headings, paragraphs, bullet and numbered lists, bold, and links. That is
 * what terms and privacy pages are made of, and it is all the admin settings
 * screen promises.
 *
 * Parsed into blocks rather than turned into an HTML string, so the renderer
 * builds React elements and nothing is ever handed to `dangerouslySetInnerHTML`.
 * The text comes from an admin, but "only an admin can write it" is exactly the
 * assumption that makes a stored cross-site scripting hole worth having, and
 * there is no reason to take it.
 *
 * Deliberately not a markdown library. This is four shapes; a parser that also
 * does tables, footnotes and HTML passthrough is 60KB and a larger surface to
 * get wrong.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; spans: Inline[] }
  | { kind: "paragraph"; spans: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

/** `**bold**` and `[text](url)`, in one pass so neither can swallow the other. */
export function parseInline(line: string): Inline[] {
  const spans: Inline[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let at = 0;

  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    if (match.index > at) {
      spans.push({ kind: "text", text: line.slice(at, match.index) });
    }

    if (match[1] !== undefined) {
      spans.push({ kind: "bold", text: match[1] });
    } else {
      const href = match[3] ?? "";
      // Only the two schemes a legal page has any business linking with.
      // `javascript:` in a link is the one thing this parser must never pass on.
      const safe = /^(https?:\/\/|mailto:|\/)/i.test(href);
      if (safe) {
        spans.push({ kind: "link", text: match[2] ?? "", href });
      } else {
        // The words, not the syntax. Keeping the raw match put
        // `[Do not click me](javascript:alert(1))` on a public legal page,
        // which is safe and reads as broken; dropping the link should leave
        // what somebody meant to say.
        spans.push({ kind: "text", text: match[2] ?? "" });
      }
    }
    at = match.index + match[0].length;
  }

  if (at < line.length) spans.push({ kind: "text", text: line.slice(at) });
  return spans.length ? spans : [{ kind: "text", text: line }];
}

const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ kind: "paragraph", spans: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map(parseInline),
    });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1]!.length as 1 | 2 | 3,
        spans: parseInline(heading[2]!),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      // A list that changes kind halfway is two lists, not one with a muddle.
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ? bullet[1] : numbered![1]) ?? "");
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
