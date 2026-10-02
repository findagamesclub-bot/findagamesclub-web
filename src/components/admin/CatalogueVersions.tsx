import NextLink from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import HistoryIcon from "@mui/icons-material/History";
import Section from "@/components/ui/Section";
import EmptyState from "@/components/ui/EmptyState";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";
import type { CatalogueVersionRow } from "@/repositories/armyCatalogue.repository";

/**
 * What has been published, and what is still reading it.
 *
 * Every publish has always been kept, frozen whole, which is what lets a game
 * recorded last April read the way it was played. There was simply no way to
 * look at one, so an admin who published twice had no route back to the first.
 *
 * The two counts are the question an admin actually has. "Can I stop thinking
 * about this version" is answered by whether anything still points at it, and
 * the answer is almost always no for the oldest ones and emphatically yes for
 * the one before last.
 */
export default function CatalogueVersions({
  versions, failed, flush = false,
}: {
  versions: CatalogueVersionRow[];
  failed: boolean;
  /** No top margin, for when it sits directly under a tab row. */
  flush?: boolean;
}) {
  return (
    <Section title="Published versions" icon={HistoryIcon} navLabel="Versions" flush={flush}
      note={failed
        ? undefined
        : versions.length === 1
          ? "One version has been published."
          : `${versions.length} versions have been published.`}>
      {failed ? (
        <Typography variant="body2" sx={{ color: tokens.danger }}>
          The version history would not load. Nothing is lost: every publish is
          frozen in the database whether or not this list draws.
        </Typography>
      ) : versions.length === 0 ? (
        <EmptyState
          title="Nothing published yet"
          description="Publishing freezes the catalogue as it stands and gives it a version. Every list and result recorded afterwards points at that version, and keeps reading it even once the draft has moved on."
        />
      ) : (
        <Box sx={{
          display: "grid", gap: 2,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
        }}>
          {versions.map((row) => (
            <VersionCard key={`${row.edition_id}:${row.catalogue_version}`} row={row} />
          ))}
        </Box>
      )}
    </Section>
  );
}

function VersionCard({ row }: { row: CatalogueVersionRow }) {
  const pinned = row.lists + row.results;

  return (
    <NextLink
      href={`/admin/catalogue/versions/${encodeURIComponent(row.catalogue_version)}`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
    <Box
      sx={{
        height: "100%", display: "flex", flexDirection: "column",
        border: `1px solid ${row.is_current ? tokens.brass : tokens.rule}`,
        backgroundColor: row.is_current ? tokens.brassSoft : tokens.paper,
        borderRadius: 1, p: 2.25,
        transition: "border-color 140ms ease",
        "&:hover": { borderColor: tokens.brass },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1.05rem" }}>
          {row.catalogue_version}
        </Typography>
        {row.is_current ? (
          <Typography sx={{ fontFamily: mono, fontSize: "0.64rem", fontWeight: 700,
                            letterSpacing: "0.1em", color: tokens.brass }}>
            IN USE
          </Typography>
        ) : null}
      </Stack>

      <Typography sx={{ mt: 0.25, fontFamily: mono, fontSize: "0.68rem",
                        letterSpacing: "0.06em", color: tokens.inkMuted }}>
        {row.edition_label.toUpperCase()} · {(shortDate(row.published_at) ?? "").toUpperCase()}
      </Typography>

      {row.note ? (
        <Typography sx={{ mt: 1.25, fontSize: "0.9rem", lineHeight: 1.55 }}>
          {row.note}
        </Typography>
      ) : null}

      <Box sx={{ flex: 1 }} />

      <Typography sx={{ mt: 1.75, fontFamily: mono, fontSize: "0.68rem",
                        letterSpacing: "0.06em", color: tokens.inkMuted }}>
        {row.factions} FACTIONS · {row.units} UNITS
      </Typography>

      <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${tokens.rule}` }}>
        {/* The figure, not a sentence about it: whether anything still points
            at a version is the one thing worth reading off this card fast. */}
        {pinned === 0 ? (
          <Typography variant="body2" sx={{ color: tokens.inkMuted }}>
            Nothing points at this version.
          </Typography>
        ) : (
          <Typography variant="body2">
            <Box component="span" sx={{ fontFamily: mono, fontWeight: 700, color: tokens.brass }}>
              {row.lists}
            </Box>{" "}
            {row.lists === 1 ? "army list" : "army lists"} and{" "}
            <Box component="span" sx={{ fontFamily: mono, fontWeight: 700, color: tokens.brass }}>
              {row.results}
            </Box>{" "}
            {row.results === 1 ? "result" : "results"} read it.
          </Typography>
        )}
      </Box>
    </Box>
    </NextLink>
  );
}
