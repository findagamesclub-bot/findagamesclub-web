import { notFound } from "next/navigation";
import PageHead from "@/components/ui/PageHead";
import LinkButton from "@/components/ui/LinkButton";
import Stack from "@mui/material/Stack";
import FactionEditor from "@/components/admin/FactionEditor";
import {
  getEditions, getFactionDetail, getFactions,
} from "@/services/armyCatalogue.service";
import { pageFrom } from "@/utils/paging";

export const metadata = { title: "Faction" };

/**
 * One faction: its detachments with their own dispositions, and its units.
 *
 * The units page and search in SQL. A faction can hold a couple of hundred and
 * the catalogue holds 1409, which is the thousand-row case the scale rules are
 * about: nothing sorts them in the browser.
 */
export default async function FactionPage({
  params, searchParams,
}: PageProps<"/admin/catalogue/[factionId]">) {
  const { factionId } = await params;
  const query = await searchParams;
  // Detachments is what a plain URL opens, so it carries the empty value the
  // way every other tab bar on the site does.
  const view = query.view === "units" ? "units" : "detachments";

  const editions = await getEditions();
  const edition = editions.find((one) => one.status === "active") ?? editions[0] ?? null;
  if (!edition) notFound();

  const [all, detail] = await Promise.all([
    getFactions(edition.id),
    getFactionDetail(edition.id, factionId, {
      query: Array.isArray(query.q) ? (query.q[0] ?? "") : (query.q ?? ""),
      page: pageFrom(query.page),
      view,
    }),
  ]);

  const faction = all.rows.find((one) => one.id === factionId);
  if (!faction) notFound();

  return (
    <>
      <Stack sx={{ alignItems: "flex-start", mb: 1 }}>
        <LinkButton variant="text" size="small" href="/admin/catalogue">
          Back to the catalogue
        </LinkButton>
      </Stack>
      <PageHead
        title={faction.label}
        lede={`${faction.detachments} ${faction.detachments === 1 ? "detachment" : "detachments"} and ${faction.units} ${faction.units === 1 ? "unit" : "units"} in ${edition.catalogue_version}.`}
      />
      <FactionEditor
        edition={edition}
        factionId={factionId}
        view={view}
        counts={{ detachments: faction.detachments, units: faction.units }}
        detachments={detail.detachments}
        units={detail.units}
        total={detail.total}
        detachmentsHeld={detail.detachmentsHeld}
        page={detail.page}
        perPage={detail.perPage}
        failed={detail.failed}
        query={Array.isArray(query.q) ? (query.q[0] ?? "") : (query.q ?? "")}
      />
    </>
  );
}
