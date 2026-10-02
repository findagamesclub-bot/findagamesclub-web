import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import EmptyState from "@/components/ui/EmptyState";
import CatalogueBoard from "@/components/admin/CatalogueBoard";
import CatalogueVersions from "@/components/admin/CatalogueVersions";
import {
  getCatalogueVersions, getEditions, getFactions,
} from "@/services/armyCatalogue.service";
import { nextSearch, searchFrom, withSearch } from "@/utils/filter-url";

export const metadata = { title: "Army catalogue" };

/**
 * The catalogue an admin maintains, and what has been published from it.
 *
 * Two tabs rather than one long page: thirty faction cards is already a scroll,
 * and the history underneath them was below the fold on every screen. Same
 * `NavTabs` the billing, shop and events pages use.
 *
 * Only the open tab is read. Getting that mapping wrong is how a section ends
 * up rendering its empty state over data nobody fetched, which reads exactly
 * like a catalogue nobody has published.
 */
export default async function AdminCataloguePage({
  searchParams,
}: PageProps<"/admin/catalogue">) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  // Factions first: this page is opened to edit the catalogue far more often
  // than to look back at what was published.
  const showing = one("tab") === "versions" ? "versions" : "factions";
  const search = one("q");

  const editions = await getEditions();
  // The one being edited: an active edition if there is one, otherwise the
  // draft somebody is part way through.
  const edition = editions.find((one) => one.status === "active") ?? editions[0] ?? null;

  const [factions, versions] = await Promise.all([
    showing === "factions" && edition
      ? getFactions(edition.id, search)
      : { rows: [], held: 0, failed: false },
    showing === "versions" ? getCatalogueVersions() : { rows: [], failed: false },
  ]);

  // The search belongs to the factions tab, so it rides along rather than
  // being thrown away by the tab row.
  const at = (tab: string) => withSearch(
    "/admin/catalogue",
    nextSearch(searchFrom(params), { tab }, { tab: "factions" }));

  return (
    <>
      <PageHead
        title="Army catalogue"
        lede={showing === "versions"
          ? "What has been published, and what is still reading it. A published version is frozen, so nothing here can be edited."
          : "Factions, detachments, their dispositions and every unit with its points. Publishing freezes a version, and every game recorded against it keeps reading the way it was played."}
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Army catalogue"
          value={showing}
          tabs={[
            { value: "factions", label: "Factions", href: at("factions") },
            { value: "versions", label: "Published versions", href: at("versions") },
          ]}
        />
      </Box>

      {showing === "versions" ? (
        <CatalogueVersions versions={versions.rows} failed={versions.failed} flush />
      ) : edition ? (
        <CatalogueBoard
          edition={edition}
          factions={factions.rows}
          held={factions.held}
          query={search}
          failed={factions.failed}
        />
      ) : (
        <EmptyState
          title="No catalogue yet"
          description="Run scripts/import-army-catalogue.mjs to bring the Warhammer 40,000 catalogue across from the legacy file, then publish it here."
        />
      )}
    </>
  );
}
