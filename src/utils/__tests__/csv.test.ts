import assert from "node:assert/strict";

import { CSV_BOM, csvFilename, toCsv } from "../csv";

// --- the shape -----------------------------------------------------------

{
  const csv = toCsv(["Name", "Tickets"], [["Ann Lee", 2]]);
  assert.ok(csv.startsWith(CSV_BOM), "Excel needs the byte order mark to read UTF-8");
  assert.equal(csv, `${CSV_BOM}Name,Tickets\r\nAnn Lee,2\r\n`);
  assert.ok(csv.endsWith("\r\n"), "a trailing newline, which every parser expects");
}

{
  assert.equal(toCsv(["Name"], []), `${CSV_BOM}Name\r\n`, "headers with no rows is still a file");
}

// --- quoting -------------------------------------------------------------

{
  assert.ok(toCsv(["A"], [["Smith, Ann"]]).includes('"Smith, Ann"'), "a comma is quoted");
  assert.ok(toCsv(["A"], [['He said "maybe"']]).includes('"He said ""maybe"""'),
    "a quote is doubled inside quotes");
  assert.ok(toCsv(["A"], [["line one\nline two"]]).includes('"line one\nline two"'),
    "a newline is quoted");
  assert.equal(toCsv(["A"], [["plain"]]), `${CSV_BOM}A\r\nplain\r\n`, "nothing else is quoted");
}

// --- the formula trap ----------------------------------------------------

{
  // A name typed into a public booking form should not become code Excel runs.
  assert.ok(toCsv(["A"], [["=1+1"]]).includes("'=1+1"));
  assert.ok(toCsv(["A"], [["+44 7700 900000"]]).includes("'+44 7700 900000"));
  assert.ok(toCsv(["A"], [["@handle"]]).includes("'@handle"));
  assert.ok(toCsv(["A"], [["-5"]]).includes("'-5"));
}

// --- empties -------------------------------------------------------------

{
  assert.equal(toCsv(["A", "B", "C"], [[null, undefined, ""]]), `${CSV_BOM}A,B,C\r\n,,\r\n`);
  assert.ok(toCsv(["A"], [[0]]).includes("\r\n0\r\n"), "zero is a number, not an empty");
}

// --- filenames -----------------------------------------------------------

{
  assert.equal(csvFilename(["door list", "Autumn Open", "2026-09-26"]),
    "door-list-autumn-open-2026-09-26.csv");
  assert.equal(csvFilename(["Warhammer 40,000 RTT"]), "warhammer-40-000-rtt.csv");
  assert.equal(csvFilename([null, "", undefined]), "export.csv", "never a bare .csv");
  assert.equal(csvFilename(["!!!"]), "export.csv", "nor a file called -.csv");
}

console.log("csv: all assertions passed");
