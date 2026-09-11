import assert from "node:assert/strict";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import { currentItem, isOn, type NavGroup } from "@/components/ui/side-nav";

const at = (label: string, href: string, rest: object = {}) =>
  ({ label, href, icon: DashboardIcon, ...rest });

const console_: NavGroup[] = [
  { title: "Your club", items: [
    at("Overview", "/clubs/didcot/manage", { exact: true }),
    at("Listing", "/clubs/didcot/manage/listing/profile",
       { owns: "/clubs/didcot/manage/listing" }),
  ] },
  { title: "People", items: [
    at("Members", "/clubs/didcot/members"),
    at("Renewals", "/clubs/didcot/members/renewals"),
  ] },
  { title: "Community", items: [
    at("Shop", "/clubs/didcot/manage/shop"),
    // An entry that lands on a tab of a page it does not own the path of.
    at("Coaching", "/clubs/didcot/manage/coaching?tab=sessions",
       { owns: "/clubs/didcot/manage/coaching" }),
  ] },
];

const lit = (pathname: string) => currentItem(console_, pathname)?.label;

// The listing entry opens step one and stays lit across all five.
assert.equal(lit("/clubs/didcot/manage/listing/profile"), "Listing");
assert.equal(lit("/clubs/didcot/manage/listing/content"), "Listing");
assert.equal(lit("/clubs/didcot/manage/listing/review"), "Listing");

// Only the most specific match lights. Renewals lives under Members, and both
// used to light on the renewals page.
assert.equal(lit("/clubs/didcot/members"), "Members");
assert.equal(lit("/clubs/didcot/members/renewals"), "Renewals");

// The console root is exact, so a page beneath it does not light it too.
assert.equal(lit("/clubs/didcot/manage"), "Overview");
assert.equal(isOn(console_[0]!.items[0]!, "/clubs/didcot/manage/team"), false);

// An entry whose link carries a query still lights on the page it lands on.
assert.equal(lit("/clubs/didcot/manage/coaching"), "Coaching");
assert.equal(lit("/clubs/didcot/manage/shop"), "Shop");

// Nothing matches outside the console.
assert.equal(lit("/clubs/didcot"), undefined);
// And a path that merely starts with the same letters is not inside it.
assert.equal(lit("/clubs/didcot/manage/listings-archive"), undefined);

console.log("side-nav: all assertions passed");
