import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCpppTenderRows,
  isPlausibleTenderReference,
  parseCpppTenderCells,
  resolveOfficialTenderUrl
} from "../scripts/lib/procurement-evidence";
import { reconcileRecords } from "../scripts/lib/reconcile";
import type { PublicMoneyRecord } from "../scripts/lib/ingestion";

const dates = ["29-Oct-2026 12:00 PM", "29-Oct-2026 12:15 PM"];
const good = ["1. LIMITED E-TENDER BID DOCUMENT FOR CATERING", "2026/IRCTC/TSV/06/OCTOBER/46", ...dates];

function record(key: string, state: PublicMoneyRecord["state"], ref: string): PublicMoneyRecord {
  return {
    externalKey: key, sensorId: "cppp-procurement", title: key,
    authority: "Government of India eProcurement System",
    jurisdiction: "India", fiscalYear: "2026-27", state,
    tenderReference: ref, sourceUrl: "https://www.eprocure.gov.in/epublish/app",
    observedAt: "2026-10-28T00:00:00Z", evidenceHash: "synthetic"
  };
}

test("strict CPPP row accepts a plausible numbered tender with two dates", () => {
  const row = parseCpppTenderCells(good);
  assert.equal(row?.reference, "2026/IRCTC/TSV/06/OCTOBER/46");
  assert.equal(row?.title, "LIMITED E-TENDER BID DOCUMENT FOR CATERING");
});

test("navigation, HTML/script and no-evidence rows fail closed", () => {
  const adversarial = [
    ["Screen Reader Access", "Screen Reader Access"],
    ["Advanced Search", "Advanced Search", ...dates],
    ["1. Example procurement", '<a href="" title="Login">', ...dates],
    ["1. Example procurement", "YOUR BROWSER JAVASCRIPT HAS BEEN DISABLED", ...dates],
    ["1. Example procurement", "HK1", ...dates],
    ["1. Example procurement", "GEM/2026/B/123", "40-Oct-2026 12:00 PM", dates[1]],
    ["1. Example procurement", "GEM/2026/B/123", dates[0], "bad date"],
    ["1. Corrigendum 01", "GEM/2026/B/123", ...dates],
    ["4. Issue of Corrigendum II for extension of date of opening", "BELF/873/07/2026", ...dates]
  ];
  for (const cells of adversarial) assert.equal(parseCpppTenderCells(cells), undefined, JSON.stringify(cells));
  assert.equal(isPlausibleTenderReference('<AHREF="LOGIN">'), false);
});

test("nested layout table and separate corrigendum table do not become tender evidence", () => {
  const html = '<table><tr><td>Advanced Search</td><td><table>' +
    '<tr><td>Tender Title</td><td>Reference No</td><td>Closing Date</td><td>Bid Opening Date</td></tr>' +
    '<tr><td>1. LIMITED E-TENDER BID DOCUMENT FOR CATERING</td><td>2026/IRCTC/TSV/06/OCTOBER/46</td>' +
    '<td>29-Oct-2026 12:00 PM</td><td>29-Oct-2026 12:15 PM</td></tr></table></td></tr></table>' +
    '<table><tr><td>Corrigendum Title</td><td>Reference No</td><td>Closing Date</td><td>Bid Opening Date</td></tr>' +
    '<tr><td>1. REVISED BID DATE</td><td>2026/IRCTC/TSV/06/OCTOBER/46</td>' +
    '<td>29-Oct-2026 12:00 PM</td><td>29-Oct-2026 12:15 PM</td></tr></table>';
  const rows = extractCpppTenderRows(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reference, "2026/IRCTC/TSV/06/OCTOBER/46");
});

test("source URL must remain official HTTPS; javascript/external links fail closed", () => {
  const base = "https://www.eprocure.gov.in/epublish/app?service=home";
  assert.equal(resolveOfficialTenderUrl("javascript:popup('x')", base), base);
  assert.equal(resolveOfficialTenderUrl("https://example.com/fake", base), base);
  assert.match(resolveOfficialTenderUrl("/epublish/app?page=detail", base), /^https:\/\/www\.eprocure\.gov\.in\//);
});

test("old snapshot HTML reference cannot generate a verified procurement link", () => {
  const bad = '<a href="" title="Login"><img src="home_login_button.png"></a>';
  assert.deepEqual(reconcileRecords([record("nav-a", "procured", bad), record("nav-b", "procured", bad)]), []);
});

test("same-stage duplicate identifiers are not financial progression", () => {
  assert.deepEqual(reconcileRecords([record("a", "tendered", good[1]), record("b", "tendered", good[1])]), []);
});

test("only source-compatible tender-to-award stages may reconcile", () => {
  const a = record("a", "tendered", good[1]);
  const b = { ...record("b", "procured", good[1]), sensorId: "cppp-contract-awards" };
  assert.equal(reconcileRecords([a, b]).length, 1);
  assert.equal(reconcileRecords([a, { ...b, authority: "Other Agency" }]).length, 0);
  assert.equal(reconcileRecords([a, { ...b, fiscalYear: "2025-26" }]).length, 0);
});
