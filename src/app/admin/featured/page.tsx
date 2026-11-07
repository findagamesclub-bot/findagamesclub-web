import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import FeaturedBoard from "@/components/admin/FeaturedBoard";
import FeaturedRequests from "@/components/admin/FeaturedRequests";
import { getBillingSettings } from "@/services/billing.service";
import {
  getClubsForPicker, getFeaturedHeadline, getFeaturedSlots,
} from "@/services/featured.service";
import { getFeaturedRequests } from "@/services/featuredRequests.service";
import { londonNow } from "@/utils/dates";
import { readFeaturedFilters } from "@/utils/featured-filters";

export const metadata = { title: "Featured clubs" };

/**
 * Who leads the homepage.
 *
 * Before this the front page said "Featured clubs" over the first six in the
 * directory, which is the word "featured" doing no work at all.
 *
 * Two jobs on one address, tabbed the way Billing and Claims are: a form of
 * five fields was sitting above the list the page is usually opened to read,
 * so seeing what is running meant scrolling past a booking nobody was making.
 * Links rather than state, so a tab is a URL somebody can send.
 */
export default async function AdminFeaturedPage({
  searchParams,
}: PageProps<"/admin/featured">) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const tab = one("tab");
  const showing = tab === "book" ? "book" : tab === "asked" ? "asked" : "slots";

  // Filtered, counted and paged in SQL. One wave, where it used to be two: the
  // payment standing rides on the row now, so the page no longer passes every
  // slot id the site has ever sold into a second function on each load.
  // The headline figure alone on the tabs that draw no list, because the tab
  // row is on all three and the page of slots is only on one of them.
  const filters = readFeaturedFilters(params);
  const [list, settings, clubs, requests] = await Promise.all([
    showing === "slots" ? getFeaturedSlots(filters) : getFeaturedHeadline(),
    getBillingSettings(),
    getClubsForPicker(),
    getFeaturedRequests(),
  ]);

  // Carried from a club's own request, so pressing "Book a slot" on it lands
  // on the form with the club already chosen and the request still attached.
  const prefillClubId = Number(one("club") ?? 0) || null;
  const requestId = Number(one("request") ?? 0) || null;
  const waiting = requests.filter((r) => r.status === "pending").length;

  const today = londonNow().date;

  return (
    <>
      <PageHead
        title="Featured clubs"
        lede={showing === "book"
          ? "Book a dated slot for a club. It starts and ends on its own, and the price is recorded against it."
          : showing === "asked"
            ? "Clubs that have put their hand up. Book one a slot, or turn it down with a reason they are told."
            : "Dated slots on the homepage. A slot ends on its own, so nobody has to remember to take it down, and clubs marked spotlight fill whatever is left."}
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Featured clubs"
          value={showing}
          tabs={[
            // What is on the homepage right now, which is the only figure on
            // this page that means somebody should look. A slot booked for
            // next month is not. Counted in SQL over every slot, because the
            // list underneath is a page of them and may be filtered besides.
            { value: "slots", label: "Slots", href: "/admin/featured", count: list.live },
            { value: "asked", label: "Asked for",
              href: "/admin/featured?tab=asked", count: waiting },
            { value: "book", label: "Book a slot", href: "/admin/featured?tab=book" },
          ]}
        />
      </Box>

      {showing === "asked" ? (
        <FeaturedRequests requests={requests} />
      ) : (
      <FeaturedBoard
        prefillClubId={prefillClubId}
        requestId={requestId}
        list={list}
        filters={filters}
        clubs={clubs}
        today={today}
        defaultPricePence={settings.featured_price_pence}
        defaultDays={settings.featured_duration_days}
        showing={showing === "book" ? "book" : "slots"}
      />
      )}
    </>
  );
}
