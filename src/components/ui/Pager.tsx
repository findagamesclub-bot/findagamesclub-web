"use client";

import NextLink from "next/link";
import Pagination from "@mui/material/Pagination";
import PaginationItem from "@mui/material/PaginationItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { mono, tokens } from "@/lib/tokens";
import { pageCount, showingLabel, PAGE_SIZE } from "@/utils/paging";

type Common = {
  page: number;
  /** Rows in the whole list, not on this page. The count line needs both. */
  total: number;
  size?: number;
  /** Plural, lower case: "members", "orders", "past events". */
  noun: string;
};

type Props = Common &
  (
    | {
        /** Builds the URL for a page, keeping whatever else is in the query. */
        hrefFor: (page: number) => string;
        onChange?: never;
      }
    | {
        hrefFor?: never;
        /** For lists filtered in the browser, where a round trip would be a step back. */
        onChange: (page: number) => void;
      }
  );

/**
 * One pager for the whole app.
 *
 * Two modes, deliberately the same control. Server-rendered lists page by link
 * so a page can be shared, bookmarked and reached with the back button; lists
 * already filtered in the browser page by callback, because they have the rows
 * in hand and a round trip would be slower than the thing it replaced.
 *
 * The count line carries its weight: "Showing 25 to 48 of 312" answers how
 * much there is, which is the question a bare page number leaves open.
 */
export default function Pager({
  page, total, noun, size = PAGE_SIZE, hrefFor, onChange,
}: Props) {
  const pages = pageCount(total, size);

  // Below one page there is nothing to page, but the count is still worth
  // saying: it is the difference between a short list and a filtered one.
  if (pages < 2) {
    return total > 0 ? (
      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", letterSpacing: "0.06em",
                        color: tokens.inkMuted, textAlign: "center", pt: 1 }}>
        {showingLabel(1, total, noun, size).toUpperCase()}
      </Typography>
    ) : null;
  }

  return (
    <Stack spacing={1.25} sx={{ alignItems: "center", pt: 2.5 }}>
      <Pagination
        count={pages}
        page={Math.min(page, pages)}
        shape="rounded"
        color="primary"
        siblingCount={1}
        boundaryCount={1}
        onChange={onChange ? (_, next) => onChange(next) : undefined}
        renderItem={(item) =>
          hrefFor && item.page ? (
            // scroll={false}: the list is usually below the fold, and jumping
            // to the hero to read page 3 loses the place you were reading.
            <PaginationItem component={NextLink} href={hrefFor(item.page)}
              scroll={false} {...item} />
          ) : (
            <PaginationItem {...item} />
          )
        }
      />
      <Typography sx={{ fontFamily: mono, fontSize: "0.72rem", letterSpacing: "0.06em",
                        color: tokens.inkMuted }}>
        {showingLabel(page, total, noun, size).toUpperCase()}
      </Typography>
    </Stack>
  );
}
