import PageHead from "@/components/ui/PageHead";
import EmptyState from "@/components/ui/EmptyState";
import CatalogueBoard from "@/components/admin/CatalogueBoard";
import { getEditions, getFactions } from "@/services/armyCatalogue.service";

export const metadata = { title: "Army catalogue" };

/**
 * The catalogue an admin maintains.
 *
 * The client's words: "Army Builder, with the catalogue an admin maintains for
 * faction, detachments, dispositions and units plus unit point costs".
 *
 * Relational to edit and snapshotted to read. Publishing freezes a version and
 * every list and result pins the one it was written against, so a catalogue
 * change cannot rewrite what somebody played last April.
 */
export default async function AdminCataloguePage({
  searchParams,
}: PageProps<"/admin/catalogue">) {
  const query = await searchParams;
  const search = Array.isArray(query.q) ? (query.q[0] ?? "") : (query.q ?? "");

  const editions = await getEditions();
  // The one being edited: an active edition if there is one, otherwise the
  // draft somebody is part way through.
  const edition = editions.find((one) => one.status === "active") ?? editions[0] ?? null;
  const factions = edition
    ? await getFactions(edition.id, search)
    : { rows: [], held: 0, failed: false };

  return (
    <>
      <PageHead
        title="Army catalogue"
        lede="Factions, detachments, their dispositions and every unit with its points. Publishing freezes a version, and every game recorded against it keeps reading the way it was played."
      />

      {edition ? (
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
