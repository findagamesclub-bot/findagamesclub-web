import { notFound } from "next/navigation";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHead from "@/components/ui/PageHead";
import Crumbs from "@/components/ui/Crumbs";
import EmptyState from "@/components/ui/EmptyState";
import FrozenFaction from "@/components/admin/FrozenFaction";
import { getCatalogueSnapshot, getCatalogueVersions } from "@/services/armyCatalogue.service";
import { factionsIn, type Catalogue } from "@/utils/army-catalogue";
import { shortDate } from "@/utils/dates";
import { display, mono, tokens } from "@/lib/tokens";

export const metadata = { title: "A published catalogue" };

/**
 * One frozen version, read only.
 *
 * Nothing here can be edited, which is the point: the database refuses writes
 * to a published version, so a screen that offered any would be offering
 * something that cannot happen. An admin comes here to answer "what did this
 * unit cost in April", and that is all this does.
 *
 * The faction is in the address rather than in component state, so a link to
 * one survives being sent to somebody and the back button undoes it.
 */
export default async function FrozenCataloguePage({
  params, searchParams,
}: PageProps<"/admin/catalogue/versions/[version]">) {
  const { version } = await params;
  const query = await searchParams;
  const wanted = Array.isArray(query.faction) ? query.faction[0] : query.faction;

  const { rows } = await getCatalogueVersions();
  const row = rows.find((one) => one.catalogue_version === version);
  if (!row) notFound();

  const snapshot = await getCatalogueSnapshot(row.edition_id, version);
  const factions = factionsIn(snapshot as Catalogue | null);
  const faction = wanted ? factions.find((one) => one.id === wanted) ?? null : null;

  return (
    <>
      <Crumbs items={[
        { label: "Army catalogue", href: "/admin/catalogue" },
        { label: version },
      ]} />

      <PageHead
        title={version}
        lede={`Published ${shortDate(row.published_at) ?? ""} by ${row.published_by}. Frozen, so nothing here can be changed. ${row.note}`.trim()}
      />

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        {[
          [`${row.factions}`, row.factions === 1 ? "faction" : "factions"],
          [`${row.units}`, row.units === 1 ? "unit" : "units"],
          [`${row.lists}`, row.lists === 1 ? "army list reads it" : "army lists read it"],
          [`${row.results}`, row.results === 1 ? "result reads it" : "results read it"],
        ].map(([figure, label]) => (
          <Stack key={label} spacing={0.25}>
            <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1.3rem",
                              color: tokens.brass }}>
              {figure}
            </Typography>
            <Typography sx={{ fontFamily: mono, fontSize: "0.66rem",
                              letterSpacing: "0.08em", color: tokens.inkMuted,
                              textTransform: "uppercase" }}>
              {label}
            </Typography>
          </Stack>
        ))}
      </Stack>

      {factions.length === 0 ? (
        <EmptyState
          title="This version holds no factions"
          description="It was published from an edition with nothing in it. The row is still here because every publish is kept, whatever it contained."
        />
      ) : faction ? (
        <FrozenFaction faction={faction} backHref={`/admin/catalogue/versions/${encodeURIComponent(version)}`} />
      ) : (
        <Box sx={{
          display: "grid", gap: 1.5,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
        }}>
          {factions.map((one) => (
            <NextLink
              key={one.id}
              href={`/admin/catalogue/versions/${encodeURIComponent(version)}?faction=${encodeURIComponent(one.id)}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
            <Box
              sx={{
                border: `1px solid ${tokens.rule}`, borderRadius: 1,
                backgroundColor: tokens.paper, p: 2, height: "100%",
                "&:hover": { borderColor: tokens.brass },
              }}
            >
              <Typography sx={{ fontFamily: display, fontWeight: 700, fontSize: "1rem" }}>
                {one.label}
              </Typography>
              <Typography sx={{ mt: 0.5, fontFamily: mono, fontSize: "0.68rem",
                                letterSpacing: "0.06em", color: tokens.inkMuted }}>
                {one.detachmentOptions.length} DETACHMENTS · {one.units.length} UNITS
              </Typography>
            </Box>
            </NextLink>
          ))}
        </Box>
      )}
    </>
  );
}
