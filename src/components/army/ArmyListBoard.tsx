"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import BusyOverlay from "@/components/ui/BusyOverlay";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import FilterBar from "@/components/account/FilterBar";
import LinkButton from "@/components/ui/LinkButton";
import { usePagedList } from "@/hooks/usePagedList";
import { PER_PAGE } from "@/utils/paging";
import { fold } from "@/utils/text";
import { shortDate } from "@/utils/dates";
import type { ArmyList } from "@/services/armyLists.service";
import { mono, tokens } from "@/lib/tokens";

/**
 * The lists at a club, or the ones somebody owns across all of them.
 *
 * A grid, three across, like every other list in this app. Yours come first
 * because that is legacy's own order and because the answer to "where is mine"
 * should never be "scroll".
 *
 * Filtered in the browser rather than in SQL: a club's whole shelf is a few
 * dozen rows and they are already in hand. If a club ever outgrows that, the
 * read is `findClubLists` and it already has a club index to page on.
 */
export default function ArmyListBoard({
  lists, basePath, showClub = false,
}: {
  lists: ArmyList[];
  /**
   * Where a card links to, as a string rather than a builder function: a
   * function cannot cross the boundary into a client component, and handing
   * one over throws at request time with tsc, the build and all four static
   * checks green. Absent means each card addresses its own club, which is
   * what the account hub needs.
   */
  basePath?: string;
  /** The account hub spans clubs, so its cards have to say which. */
  showClub?: boolean;
}) {
  const top = useRef<HTMLDivElement>(null);
  const [sifting, startSift] = useTransition();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "mine" | "theirs">("all");
  const [sort, setSort] = useState<"recent" | "points" | "name">("recent");

  const shown = useMemo(() => {
    const needle = fold(query.trim());
    const matched = lists.filter((one) => {
      if (tab === "mine" && !one.isOwner) return false;
      if (tab === "theirs" && one.isOwner) return false;
      if (!needle) return true;
      return fold(one.name).includes(needle)
        || fold(one.factionLabel).includes(needle)
        || (one.current?.detachments ?? []).some((d) =>
            fold(d.detachment).includes(needle));
    });
    // Yours stay first whatever the sort, because "where is mine" should never
    // be answered with "scroll".
    const by = (a: ArmyList, b: ArmyList) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "points") {
        return (b.current?.totalPoints ?? 0) - (a.current?.totalPoints ?? 0);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    };
    return [...matched].sort(by);
  }, [lists, query, tab, sort]);

  const paged = usePagedList(shown, PER_PAGE.cards, top);

  if (!lists.length) {
    return (
      <EmptyState title="No lists yet"
        description="A list is a faction, its detachments and the units you are taking, priced against the club's catalogue." />
    );
  }

  return (
    <Stack spacing={2}>
      <FilterBar
        query={query} onQuery={(value) => startSift(() => setQuery(value))}
        placeholder="Find a list, faction or detachment"
        tabs={[
          { value: "all", label: "All", count: lists.length },
          { value: "mine", label: "Yours",
            count: lists.filter((one) => one.isOwner).length },
          { value: "theirs", label: "Clubmates",
            count: lists.filter((one) => !one.isOwner).length },
        ]}
        filter={tab} onFilter={(value) => startSift(() => setTab(value))}
        sorts={[
          { value: "recent", label: "Last changed" },
          { value: "points", label: "Points" },
          { value: "name", label: "Name" },
        ]}
        sort={sort} onSort={(value) => startSift(() => setSort(value))} />

      <BusyOverlay busy={sifting} variant="dim" label="Filtering the lists">
      {shown.length === 0 ? (
        <EmptyState title="Nothing matches that"
          description="Try the faction or the detachment instead of the list's name." />
      ) : null}

      <Box ref={top} sx={{ display: "grid", gap: 2, alignItems: "stretch",
                 gridTemplateColumns: { xs: "minmax(0, 1fr)",
                                        sm: "repeat(2, minmax(0, 1fr))",
                                        lg: "repeat(3, minmax(0, 1fr))" } }}>
        {paged.shown.map((list) => (
          <Stack key={list.id} spacing={1.25}
            sx={{ height: "100%", p: 2, borderRadius: 1.5,
                  border: `1px solid ${list.isOwner ? tokens.brass : tokens.rule}`,
                  backgroundColor: tokens.paper }}>
            <Stack spacing={0.25}>
              <Typography sx={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.25 }}>
                {list.name}
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", color: tokens.inkMuted }}>
                {list.factionLabel || "No faction yet"}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1}
              sx={{ alignItems: "baseline", flexWrap: "wrap" }} useFlexGap>
              <Typography sx={{ fontFamily: mono, fontSize: "1.35rem", fontWeight: 700,
                                lineHeight: 1, color: tokens.brass }}>
                {(list.current?.totalPoints ?? 0).toLocaleString("en-GB")}
              </Typography>
              <Typography sx={{ fontFamily: mono, fontSize: "0.7rem",
                                color: tokens.inkMuted }}>
                {list.listType === "collection"
                  ? "points on the shelf"
                  : `of ${Number(list.pointsLimit || 0).toLocaleString("en-GB")}`}
              </Typography>
            </Stack>

            {list.current?.detachments.length ? (
              <Typography sx={{ fontSize: "0.78rem", color: tokens.inkMuted }}>
                {list.current.detachments
                  .map((d) => [d.detachment, d.disposition].filter(Boolean).join(" · "))
                  .join(", ")}
              </Typography>
            ) : null}

            <Box sx={{ flex: 1 }} />

            <Typography sx={{ pt: 1, borderTop: `1px solid ${tokens.rule}`,
                              fontFamily: mono, fontSize: "0.66rem",
                              color: tokens.inkMuted }}>
              {[
                `v${list.current?.versionNumber ?? 1}`,
                // "1 units" is the same slip `showingLabel` shipped in stage 5
                // across twenty nouns. A count needs its singular.
                `${list.current?.units.length ?? 0} `
                  + `${list.current?.units.length === 1 ? "unit" : "units"}`,
                showClub ? list.clubName : (list.isOwner ? "Yours" : "A clubmate's"),
                shortDate(list.updatedAt),
              ].filter(Boolean).join(" · ")}
            </Typography>

            <LinkButton size="small" variant={list.isOwner ? "contained" : "outlined"}
              href={basePath
                ? `${basePath}/${list.id}`
                : `/clubs/${list.clubSlug}/army-builder/${list.id}`}>
              {list.isOwner ? "Open" : "Read it"}
            </LinkButton>
          </Stack>
        ))}
      </Box>

      <Pager page={paged.page} total={paged.total} size={PER_PAGE.cards}
        noun="lists" onChange={paged.goTo} />
      </BusyOverlay>
    </Stack>
  );
}
