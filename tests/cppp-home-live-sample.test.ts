import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCpppHomeRow } from "../scripts/lib/cppp-home-rows.ts";

/**
 * Manually transcribed visible four-column listings from the official CPPP
 * homepage displaying 27-Oct-2026, read-only on 28-Oct-2026:
 * https://www.eprocure.gov.in/epublish/app?service=home
 * Ten Latest Tenders + ten Latest Corrigendums. Source-rendered convenience
 * sample, not a machine-verifiable raw HTML snapshot or proof of tender identity.
 */
const displayed: readonly (readonly [string, string, string, string])[] = [
  ["1. 51222/STR STEEL/ROLLED SECTION/ENQ/02", "51222/STR STEEL/ROLLED SECTION/ENQ/02", "02-Nov-2026 06:55 PM", "03-Nov-2026 06:55 PM"],
  ["2. B AND R/71149/IOCL/PANIPAT/STR DTLG/SITE/LC/NIT/02", "B AND R/71149/IOCL/PANIPAT/STR DTLG/SITE/LC/NIT/02", "02-Nov-2026 06:55 PM", "03-Nov-2026 06:55 PM"],
  ["3. KD", "KDELECT26271784", "16-Nov-2026 03:00 PM", "16-Nov-2026 04:00 PM"],
  ["4. BANDR/71149/IOCL/ INSULATION/SITE/SC/NIT/01", "B AND R/71149/IOCL/ INSULATION/SITE/SC/NIT/01", "02-Nov-2026 06:55 PM", "03-Nov-2026 06:55 PM"],
  ["5. HUDCO/HRO/IT DISPOASL/2026", "NO/HUDCO/HRO/IT ASSETS DISPOSAL/2026", "10-Nov-2026 03:00 PM", "10-Nov-2026 03:30 PM"],
  ["6. Electro Physiology System - Patch Clamp", "GTE01/9137/2026/091/ELPHPATCH", "03-Nov-2026 03:00 PM", "04-Nov-2026 03:00 PM"],
  ["7. Groove Cutting", "B AND R/71135/IOCL/NOTICE/GROOVE CUTTING/01", "02-Nov-2026 06:00 PM", "03-Nov-2026 06:00 PM"],
  ["8. EOI Document for Selection of Partner For Supply, Installation and Commissioning of E Document Management System for Equal Opportunities Commission", "TCIL/MUR/EOI/2026/T-42", "03-Nov-2026 02:00 PM", "03-Nov-2026 02:30 PM"],
  ["9. Acquisition of 8 no. New-Building Very Large Gas Carriers (VLGCs)", "T and OS/VLGC(JVC)/2026/01", "26-Nov-2026 05:00 PM", "27-Nov-2026 03:00 PM"],
  ["10. Repairing, renovation and installation of furniture at Room No-204 (Dr. Subbhadeep Datta) at first floor of the ERU Building", "IACS/CIVIL/927/2026-27/39", "05-Nov-2026 03:00 PM", "05-Nov-2026 03:30 PM"],
  ["1. Corrigendum 01", "HK1", "03-Nov-2026 05:00 PM", "04-Nov-2026 05:00 PM"],
  ["2. Corregendum 01", "HK1", "03-Nov-2026 05:00 PM", "04-Nov-2026 05:00 PM"],
  ["3. Due date extension", "PE-294/546", "04-Nov-2026 03:00 PM", "06-Nov-2026 03:30 PM"],
  ["4. Corrigendum - 1", "PUR/ENQ/JB/042/STOCK/ 7705/2026-27", "04-Nov-2026 06:55 PM", "05-Nov-2026 06:55 PM"],
  ["5. Corrigendum - 4", "PUR/ENQ/JB/7625/STOCK/ 035/2026-27", "04-Nov-2026 06:55 PM", "05-Nov-2026 06:55 PM"],
  ["6. Corrigendum - 5", "PUR/ENQ/STOCK/7644/JB/ 036/2026-27", "03-Nov-2026 06:55 PM", "04-Nov-2026 06:55 PM"],
  ["7. Corrigendum-4", "DC-04/2026", "30-Oct-2026 12:00 PM", "30-Oct-2026 12:05 PM"],
  ["8. BARIUM NITRATE GRADE I OPENING DATE EXT FROM 27 OCT 26 TO 03 NOV 2026", "GEM/2026/B/8154596", "03-Nov-2026 11:00 AM", "03-Nov-2026 11:30 AM"],
  ["9. Addendum 1", "10/T-2117/2026-C", "10-Nov-2026 02:30 PM", "10-Nov-2026 03:00 PM"],
  ["10. Corrigendum 1", "GEM/2026/B/8151813", "03-Nov-2026 11:00 AM", "04-Nov-2026 11:00 AM"]
];

test("E339: all twenty manually transcribed visible CPPP listings are admissible", () => {
  const admitted = displayed.map((row) => parseCpppHomeRow(row));
  assert.equal(admitted.filter(Boolean).length, 20, JSON.stringify(displayed.filter((_, i) => !admitted[i])));
  assert.equal(admitted[10]?.reference, "HK1");
  assert.equal(admitted[11]?.reference, "HK1");
});

test("E339: short source reference does not waive other admission gates", () => {
  const good = displayed[10];
  for (const reference of ["1", "H1", "HK", "login", "<a>HK1"]) {
    assert.equal(parseCpppHomeRow([good[0], reference, good[2], good[3]]), null, reference);
  }
  assert.equal(parseCpppHomeRow(["Screen Reader Access", "HK1", good[2], good[3]]), null);
  assert.equal(parseCpppHomeRow([good[0], "HK1", "", ""]), null);
  assert.equal(parseCpppHomeRow([good[0], "HK1", "31-Feb-2026 05:00 PM", good[3]]), null);
});

test("E339: two same-reference corrigendum headings do not establish one identity", () => {
  const parsed = displayed.slice(10, 12).map((row) => parseCpppHomeRow(row));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.reference, parsed[1]?.reference);
  assert.notEqual(parsed[0]?.title, parsed[1]?.title);
});
