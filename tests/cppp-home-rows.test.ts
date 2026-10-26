import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCpppHomeRow } from "../scripts/lib/cppp-home-rows.ts";

const valid = [
  "1. GeM bid No GEM/2026/B/8190425 published for selection of Software Development Agency",
  "GEM/2026/B/8190425",
  "07-Nov-2026 03:00 PM",
  "08-Nov-2026 03:00 PM"
];

test("E301: admits strict four-cell public tender and corrigendum rows", () => {
  assert.equal(parseCpppHomeRow(valid)?.reference, "GEM/2026/B/8190425");
  assert.equal(parseCpppHomeRow([
    "8. BOQ CORRIGENDUM", "IITM/UPS-CAMC_AMC/14/2627/SPL",
    "27-Oct-2026 04:00 PM", "28-Oct-2026 04:00 PM"
  ])?.reference, "IITM/UPS-CAMC_AMC/14/2627/SPL");
  assert.equal(parseCpppHomeRow([
    "3. SPACE GRADE MRAM", "VSSC/PURCHASE UNIT II (AVN)/ VS202500766401",
    "11-Nov-2026 02:00 PM", "11-Nov-2026 02:30 PM"
  ])?.reference, "VSSC/PURCHASE UNIT II (AVN)/ VS202500766401");
});

test("E301: rejects page furniture, parent tables and malformed timestamps", () => {
  const invalid = [
    ["Screen Reader Access", "Screen Reader Access"],
    ["26-Oct-2026", "Search | Active Tenders", "", ""],
    ["1. Login", "<a href=''>document.getElementById(123)</a>", valid[2], valid[3]],
    ["1. Tenders", "GEM/2026/B/8190425", "", ""],
    ["1. Tenders", "GEM/2026/B/8190425", "31-Feb-2026 03:00 PM", valid[3]],
    ["1. Tenders", "GEM/2026/B/8190425", "07-Nov-2026 13:00 PM", valid[3]],
    ["1. Tenders", "GEM/2026/B/8190425", valid[2], valid[3], "nested fifth cell"],
    ["1. Tenders", "Screen Reader Access", valid[2], valid[3]]
  ];
  for (const cells of invalid) assert.equal(parseCpppHomeRow(cells), null, JSON.stringify(cells));
});

test("E301: executable HTML/code fails closed without blocking ordinary document titles", () => {
  assert.equal(parseCpppHomeRow(["1. <script>alert(1)</script>", valid[1], valid[2], valid[3]]), null);
  assert.equal(parseCpppHomeRow(["1. function formSubmit()", valid[1], valid[2], valid[3]]), null);
  assert.equal(parseCpppHomeRow(["1. document.getElementById(123)", valid[1], valid[2], valid[3]]), null);
  assert.equal(parseCpppHomeRow(["1. Document management system", valid[1], valid[2], valid[3]])?.reference, valid[1]);
});

test("E301: unsupported references and title-less rows cannot be promoted", () => {
  assert.equal(parseCpppHomeRow(["1. Tender", "login123;drop", valid[2], valid[3]]), null);
  assert.equal(parseCpppHomeRow(["", valid[1], valid[2], valid[3]]), null);
  assert.equal(parseCpppHomeRow(["1. Tender", "x".repeat(161) + "1", valid[2], valid[3]]), null);
});
