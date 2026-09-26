import Box from "@mui/material/Box";
import PageHead from "@/components/ui/PageHead";
import NavTabs from "@/components/ui/NavTabs";
import FeaturedBoard from "@/components/admin/FeaturedBoard";
import { getBillingSettings } from "@/services/billing.service";
import { getClubsForPicker, getSlots } from "@/services/featured.service";
import { londonNow } from "@/utils/dates";

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
  const asked = params.tab;
  const showing = (Array.isArray(asked) ? asked[0] : asked) === "book" ? "book" : "slots";

  const [slots, settings, clubs] = await Promise.all([
    getSlots(),
    getBillingSettings(),
    getClubsForPicker(),
  ]);

  const today = londonNow().date;
  // What is on the homepage right now, which is the only figure on this page
  // that means somebody should look. A slot booked for next month is not.
  const liveNow = slots.filter((s) => s.starts_on <= today && s.ends_on >= today).length;

  return (
    <>
      <PageHead
        title="Featured clubs"
        lede={showing === "book"
          ? "Book a dated slot for a club. It starts and ends on its own, and the price is recorded against it."
          : "Dated slots on the homepage. A slot ends on its own, so nobody has to remember to take it down, and clubs marked spotlight fill whatever is left."}
      />

      <Box sx={{ mb: 3 }}>
        <NavTabs
          ariaLabel="Featured clubs"
          value={showing}
          tabs={[
            { value: "slots", label: "Slots", href: "/admin/featured", count: liveNow },
            { value: "book", label: "Book a slot", href: "/admin/featured?tab=book" },
          ]}
        />
      </Box>

      <FeaturedBoard
        slots={slots}
        clubs={clubs}
        today={today}
        defaultPricePence={settings.featured_price_pence}
        defaultDays={settings.featured_duration_days}
        showing={showing}
      />
    </>
  );
}
