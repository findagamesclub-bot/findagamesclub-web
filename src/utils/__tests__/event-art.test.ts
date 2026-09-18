import assert from "node:assert/strict";

import { eventArt } from "../event-art";

const club = { src: "/clubs/didcot.jpg", alt: "Didcot Wargames" };
const event = { logoSrc: null as string | null, logoAlt: null as string | null,
                title: "Didcot Winter Open" };

// --- the event's own wins -------------------------------------------------

{
  const art = eventArt({ ...event, logoSrc: "/media/winter.jpg", logoAlt: "Two players" }, club);
  assert.deepEqual(art, { src: "/media/winter.jpg", alt: "Two players" });
}

{
  // Uploaded with no alt text: the event's name describes it rather than
  // leaving a screen reader with nothing.
  const art = eventArt({ ...event, logoSrc: "/media/winter.jpg", logoAlt: "" }, club);
  assert.deepEqual(art, { src: "/media/winter.jpg", alt: "Didcot Winter Open" });

  const spaces = eventArt({ ...event, logoSrc: "/media/winter.jpg", logoAlt: "   " }, club);
  assert.equal(spaces?.alt, "Didcot Winter Open");
}

// --- falling back to the club --------------------------------------------

{
  assert.deepEqual(eventArt(event, club), club, "no picture of its own");
  assert.deepEqual(eventArt({ ...event, logoSrc: "" }, club), club);
  assert.deepEqual(eventArt({ ...event, logoSrc: "   " }, club), club,
    "whitespace is not a picture");
}

{
  assert.equal(eventArt(event, null), null,
    "neither: the caller draws its monogram plate, not a grey box");
}

console.log("event-art: all assertions passed");
