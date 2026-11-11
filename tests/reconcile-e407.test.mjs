import assert from "node:assert/strict";
import test from "node:test";
import { extractTenderReference, isPlausibleTenderReference, reconcileRecords } from "../scripts/lib/reconcile.ts";

function record(overrides = {}) {
  return {
    externalKey: "ref-1",
    sensorId: "source-a",
    title: "Synthetic tender observation",
    authority: "Municipal Authority A",
    jurisdiction: "Mumbai",
    fiscalYear: "2026-27",
    state: "procured",
    observedAt: "2026-10-30T00:00:00Z",
    sourceUrl: "https://example.org/public-record",
    evidenceHash: "synthetic",
    tenderReference: "ABC 12345",
    ...overrides
  };
}

test("E407: same reference across authorities is not a verified link", () => {
  assert.deepEqual(reconcileRecords([
    record(), record({ externalKey: "ref-2", authority: "Authority B", state: "paid" })
  ]), []);
});

test("E407: same reference across fiscal years is not a verified link", () => {
  assert.deepEqual(reconcileRecords([
    record(), record({ externalKey: "ref-2", fiscalYear: "2025-26", state: "paid" })
  ]), []);
});

test("E407: duplicate same-state records do not imply progression", () => {
  assert.deepEqual(reconcileRecords([
    record(), record({ externalKey: "ref-2", state: "procured" })
  ]), []);
});

test("E407: missing fiscal-year context fails closed", () => {
  assert.deepEqual(reconcileRecords([
    record({ fiscalYear: undefined }),
    record({ externalKey: "ref-2", state: "paid", fiscalYear: undefined })
  ]), []);
});

test("E407: three-record ambiguity is not silently linearized", () => {
  assert.deepEqual(reconcileRecords([
    record(), record({ externalKey: "ref-2", state: "paid" }),
    record({ externalKey: "ref-3", state: "audited" })
  ]), []);
});

test("E407: reused external key across sensors is not linkable by current DB key", () => {
  assert.deepEqual(reconcileRecords([
    record(), record({ sensorId: "source-b", state: "paid" })
  ]), []);
});

test("E407: matching context preserves only a noncausal exact-reference relation", () => {
  const links = reconcileRecords([
    record({ tenderReference: " abc 12345 " }),
    record({ externalKey: "ref-2", state: "paid", tenderReference: "ABC12345" })
  ]);
  assert.deepEqual(links, [{
    fromExternalKey: "ref-1",
    toExternalKey: "ref-2",
    relation: "shared_tender_reference",
    basis: "exact_tender_reference",
    confidence: 1,
    reference: "ABC12345"
  }]);
});


test("E513: rejects HTML, script and navigation text as tender references", () => {
  assert.equal(isPlausibleTenderReference('<a href="" title="Login"><img src="login.png"></a> Find My Nodal Officer'), false);
  assert.equal(isPlausibleTenderReference("Search | Active Tenders | Corrigendum | CPPP HOME"), false);
  assert.equal(isPlausibleTenderReference("Latest Tenders updates every 15 mins."), false);
  assert.equal(isPlausibleTenderReference("11-Nov-2026"), false);
});

test("E513: accepts observed CPPP reference formats without treating titles as IDs", () => {
  const references = [
    "NCL/Block-B/EM/QN/26-27/851 dt. 10.11.2026",
    "TIFR/PD/CF26-112/261570",
    "MO/AAI/51287/SOLAR PV PLANT/NIT/SC/01",
    "HO/DIT/1571/2026-27",
    "KRO1126105470",
    "VSP/WC/Mines MDM/OT/2600010082",
    "CY-PRJ-057-26-27",
    "PH-PRJ-058-26-27",
    "91-84/PnW/W/2071",
    "BECIL/ADMIN/RFP/SOLAR/2026-27",
    "2026 DDK 09",
    "ABC 12345"
  ];
  for (const reference of references) assert.equal(isPlausibleTenderReference(reference), true, reference);
  assert.equal(isPlausibleTenderReference("1. Assistance in day to day maintenance for 60 days."), false);
});

test("E513: reads the second table cell and rejects aggregate parent rows", () => {
  const actual = extractTenderReference([
    "1. Assistance in day to day maintenance of telephone lines for 60 days.",
    "NCL/Block-B/EM/QN/26-27/851 dt. 10.11.2026",
    "16-Nov-2026 09:30 AM",
    "16-Nov-2026 10:00 AM"
  ]);
  assert.equal(actual, "NCL/Block-B/EM/QN/26-27/851 dt. 10.11.2026");

  const parent = extractTenderReference([
    "1. TNO278... 2. TNO236... 3. TNO274... 10. Extension of date...",
    "1. TNO278-OCT26-EAST_1",
    "17-Nov-2026 06:00 PM"
  ]);
  assert.equal(parent, undefined);

  assert.equal(extractTenderReference(["Screen Reader Access", "Screen Reader Access"]), undefined);
});

test("E513: malformed HTML reference cannot create a graph link even across different states", () => {
  const htmlReference = '<a href="" title="Login"><img src="login.png"></a> Find My Nodal Officer';
  assert.deepEqual(reconcileRecords([
    record({ tenderReference: htmlReference }),
    record({ externalKey: "ref-2", state: "paid", tenderReference: htmlReference })
  ]), []);
});
