import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import PageHead from "@/components/ui/PageHead";
import MetaBoard from "@/components/meta/MetaBoard";
import { getCurrentProfile } from "@/services/auth.service";
import { getMeta, getScopes } from "@/services/meta.service";
import { readLens, lensLabel } from "@/utils/meta-lens";
import { META_TABS, readTab } from "@/utils/meta-tabs";

export const metadata = { title: "Meta Tracker" };

/**
 * What wins, across every club that records it.
 *
 * The client asked for this twice, both times as "replicate local app", so
 * legacy's rules are the spec: a table booking counts once the club has
 * confirmed it, podiums strengthen a signal without inventing a win, anything
 * under two games is flagged rather than hidden, and the six caveats are on
 * the page rather than in a footnote.
 *
 * Signed in only, and the club picker offers only the clubs the reader belongs
 * to. `meta_scope_allowed` enforces that again in SQL, because the address is
 * a thing anybody can type.
 */
export default async function MetaTrackerPage({
  searchParams,
}: PageProps<"/meta-tracker">) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/auth/sign-in?next=/meta-tracker");

  const query = await searchParams;
  const one = (key: string) => {
    const raw = query[key];
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  };

  const tab = readTab(one("tab"));
  const lens = readLens(one("lens"));
  const scope = one("scope");
  const club = /^\d+$/.test(scope) ? Number(scope) : null;

  // One wave. The picker does not need the numbers and the numbers do not
  // need the picker.
  const [view, scopes] = await Promise.all([
    getMeta({ tab, club, lens }),
    getScopes(),
  ]);

  const at = META_TABS.map((one) => ({
    value: one.value,
    href: `/meta-tracker?tab=${one.value}`
      + (scope ? `&scope=${scope}` : "") + `&lens=${lens}`,
  }));

  const named = scopes.find((s) => s.clubId === club);

  return (
    <Container maxWidth="lg" component="main" sx={{ py: { xs: 4, md: 6 } }}>
      <PageHead
        title="Meta Tracker"
        // A refused scope cannot be named, and the site-wide wording would be
        // a claim about numbers this reader is not being shown. The board
        // underneath says why; the heading just stops promising.
        lede={view.refused
          ? "Narrowed to a club you do not belong to."
          : `What wins at ${named ? named.name : "the clubs on this site"}, `
            + `over ${lensLabel(lens).toLowerCase()}. Built only from results `
            + "clubs have confirmed."}
      />
      <MetaBoard view={view} tab={tab} scope={scope} lens={lens}
        scopes={scopes} at={at} />
    </Container>
  );
}
