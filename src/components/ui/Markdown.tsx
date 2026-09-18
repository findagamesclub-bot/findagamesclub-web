import NextLink from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { parseMarkdown, type Inline } from "@/utils/markdown-blocks";
import { tokens } from "@/lib/tokens";

/**
 * Text an admin wrote, rendered.
 *
 * Built as React elements from parsed blocks, never through
 * `dangerouslySetInnerHTML`. The parser drops any link scheme that is not http,
 * https, mailto or a path of our own, so there is no route from the settings
 * screen to running script on a legal page.
 *
 * Renders from Server Components, so links are plain `next/link` rather than
 * MUI with `component={NextLink}`, which throws at request time while tsc and
 * the build stay green.
 */

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.kind === "bold") return <strong key={i}>{span.text}</strong>;
        if (span.kind === "link") {
          const internal = span.href.startsWith("/");
          return internal ? (
            <NextLink key={i} href={span.href} style={{ color: tokens.brand }}>
              {span.text}
            </NextLink>
          ) : (
            <a key={i} href={span.href} style={{ color: tokens.brand }}
              {...(span.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
              {span.text}
            </a>
          );
        }
        return <span key={i}>{span.text}</span>;
      })}
    </>
  );
}

export default function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  if (!blocks.length) return null;

  return (
    <Stack spacing={2} sx={{ maxWidth: 680 }}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <Typography
              key={index}
              variant={block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3"}
              sx={{
                fontSize: block.level === 1 ? "2rem" : block.level === 2 ? "1.4rem" : "1.1rem",
                mt: index === 0 ? 0 : 1.5,
              }}
            >
              <Spans spans={block.spans} />
            </Typography>
          );
        }

        if (block.kind === "list") {
          return (
            <Box key={index} component={block.ordered ? "ol" : "ul"}
              sx={{ pl: 3, m: 0, display: "grid", gap: 0.75 }}>
              {block.items.map((item, i) => (
                <Typography key={i} component="li" variant="body1">
                  <Spans spans={item} />
                </Typography>
              ))}
            </Box>
          );
        }

        return (
          <Typography key={index} variant="body1">
            <Spans spans={block.spans} />
          </Typography>
        );
      })}
    </Stack>
  );
}
