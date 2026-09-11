import assert from "node:assert/strict";
import {
  itemRefusal, slugifyItem, tidyItemPrice, uniqueItemSlug,
  MAX_ITEM_NAME, type ItemDraft,
} from "../shop-item";

// Legacy's slug, character for character.
assert.equal(slugifyItem("Club t shirt"), "club-t-shirt");
assert.equal(slugifyItem("  Dice & Bags  "), "dice-and-bags");
assert.equal(slugifyItem("Warhammer 40,000 mat"), "warhammer-40-000-mat");
assert.equal(slugifyItem("!!!"), "");

// Two items of the same name still need telling apart.
assert.equal(uniqueItemSlug("Club t shirt", []), "club-t-shirt");
assert.equal(uniqueItemSlug("Club t shirt", ["club-t-shirt"]), "club-t-shirt-2");
assert.equal(uniqueItemSlug("Club t shirt", ["club-t-shirt", "club-t-shirt-2"]), "club-t-shirt-3");
// A name of pure punctuation would otherwise write an empty key.
assert.equal(uniqueItemSlug("!!!", []), "item");
assert.equal(uniqueItemSlug("!!!", ["item"]), "item-2");

// "TBC" is what the rest of the app reads as "ask the club".
assert.equal(tidyItemPrice(""), "TBC");
assert.equal(tidyItemPrice("   "), "TBC");
assert.equal(tidyItemPrice(" £15 "), "£15");

const ok: ItemDraft = {
  name: "Club t shirt", category: "Clothing", description: "Blue, club logo",
  price: "£15", imageSrc: "", imageAlt: "", minimumTierKey: "",
};
assert.equal(itemRefusal(ok, ["premium-membership"]), null);
assert.equal(itemRefusal({ ...ok, minimumTierKey: "premium-membership" },
  ["premium-membership"]), null);

assert.match(itemRefusal({ ...ok, name: "  " }, []) ?? "", /Give the item a name/);
assert.match(itemRefusal({ ...ok, name: "x".repeat(MAX_ITEM_NAME + 1) }, []) ?? "",
  /at most 80 characters/);
// A tier the club has since removed would hide the item from everybody.
assert.match(itemRefusal({ ...ok, minimumTierKey: "gone" }, ["premium-membership"]) ?? "",
  /not one of yours/);
// A picture nobody can fetch is a broken image on the shop page.
assert.match(itemRefusal({ ...ok, imageSrc: "shirt.jpg" }, []) ?? "", /start with https/);
assert.equal(itemRefusal({ ...ok, imageSrc: "https://example.com/a.jpg" }, []), null);
// An empty price is fine: it becomes TBC.
assert.equal(itemRefusal({ ...ok, price: "" }, []), null);

console.log("shop-item: all assertions passed");
