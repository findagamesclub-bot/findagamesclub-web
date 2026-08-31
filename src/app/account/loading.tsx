import PageSkeleton from "@/components/account/PageSkeleton";
import ScrollToTop from "@/components/ui/ScrollToTop";

/**
 * Shown in the content column while a section loads.
 *
 * Its presence is what makes navigation instant: without a loading boundary,
 * Next holds the old page until the new one's data has arrived, so clicking a
 * sidebar item did nothing visible until it was ready. The sidebar sits in the
 * layout above this, so it never blinks.
 */
export default function AccountLoading() {
  return (
    <>
      <ScrollToTop />
      <PageSkeleton />
    </>
  );
}
