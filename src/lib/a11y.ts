/**
 * Off the screen, still in the accessibility tree.
 *
 * For the sentence that says in words what an arrow or a colour says at a
 * glance. Colour never carries a fact alone, and neither does an icon, so the
 * fact goes here and sighted readers never see it twice.
 *
 * **`width: 1` in MUI's `sx` is 100%, not one pixel.** Numbers between 0 and 1
 * are read as a fraction for width and height, so the usual
 * `position: absolute; width: 1; height: 1` clip recipe copied from the web
 * makes a box the full size of its container. Absolutely positioned and the
 * full width of the page, it pushed `/admin/analytics` to 764px inside a
 * 500px window. Found by measuring the overflow, not by looking: it is
 * invisible either way, which is exactly why it went unnoticed in
 * `PostCard` first.
 *
 * `clipPath` as well as `clip`, because `clip` is deprecated and ignored by
 * some engines, and `nowrap` so a long sentence cannot be wrapped into a
 * column one pixel wide and reported as a page a thousand pixels tall.
 */
export const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
