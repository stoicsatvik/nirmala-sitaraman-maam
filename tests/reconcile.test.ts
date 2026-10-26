import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileRecords, resolveLinkRows } from "../scripts/lib/reconcile.ts";
import type { PublicMoneyRecord, RecordState } from "../scripts/lib/ingestion.ts";

function record(sensorId: string, state: RecordState, tenderReference: string, jurisdiction = "India"): PublicMoneyRecord {
  return {
    externalKey: [sensorId, state, jurisdiction].join(":"),
    sensorId,
    state,
    tenderReference,
    title: "Synthetic evidence fixture",
    authority: "Fixture",
    fiscalYear: "2026-27",
    jurisdiction,
    observedAt: "2026-10-23T00:00:00Z",
    sourceUrl: "https://example.org/source",
    evidenceHash: "fixture"
  };
}

test("rejects HTML/JavaScript and navigation labels as exact references", () => {
  const bad = [
    "<script>login()</script>",
    "javascript:document.location=12345",
    "function(){return 12345}",
    "Login to Tender 12345",
    "tender",
    "1234",
    "foo@example.com/12345",
    "x".repeat(101) + "1"
  ];
  for (const ref of bad) {
    assert.deepEqual(reconcileRecords([
      record("sensor-a", "budgeted", ref),
      record("sensor-b", "procured", ref)
    ]), [], ref);
  }
});

test("links a real-shaped identifier across distinct sources and stages within a jurisdiction", () => {
  const links = reconcileRecords([
    record("notice-source", "budgeted", "GEM/2026/B/12345"),
    record("award-source", "procured", "gem/2026/b/12345")
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].reference, "GEM/2026/B/12345");
  assert.equal(links[0].relation, "shared tender reference (budgeted / procured); fund flow unverified");
});

test("rejects same-stage or same-source false chains", () => {
  assert.deepEqual(reconcileRecords([
    record("a", "procured", "2026_MCGM_12345"),
    record("b", "procured", "2026_MCGM_12345")
  ]), []);
  assert.deepEqual(reconcileRecords([
    record("a", "budgeted", "2026_MCGM_12345"),
    record("a", "procured", "2026_MCGM_12345")
  ]), []);
});

test("normalizes harmless whitespace and case without losing reference identity", () => {
  const links = reconcileRecords([
    record("a", "budgeted", "GEM / 2026 / B / 12345"),
    record("b", "procured", "gem/2026/b/12345")
  ]);
  assert.equal(links.length, 1);
});

test("does not invent exact evidence links across different jurisdictions", () => {
  const records = [
    record("union", "budgeted", "GEM/2026/B/12345", "India"),
    record("municipal", "procured", "GEM/2026/B/12345", "Mumbai")
  ];
  assert.deepEqual(reconcileRecords(records), []);
  assert.deepEqual(reconcileRecords([...records].reverse()), []);
});

test("separates unrelated jurisdiction groups without suppressing valid within-group links", () => {
  const records = [
    record("a", "budgeted", "GEM/2026/B/12345", "India"),
    record("b", "procured", "GEM/2026/B/12345", "India"),
    record("c", "budgeted", "GEM/2026/B/12345", "Mumbai"),
    record("d", "procured", "GEM/2026/B/12345", "Mumbai")
  ];
  const links = reconcileRecords(records);
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((link) => [link.fromExternalKey, link.toExternalKey]), [
    [records[0].externalKey, records[1].externalKey],
    [records[2].externalKey, records[3].externalKey]
  ]);
  assert.deepEqual(reconcileRecords([
    record("a", "budgeted", "GEM/2026/B/12345", ""),
    record("b", "procured", "GEM/2026/B/12345", "")
  ]), []);
});

test("identical external keys from distinct sensors are not silently deduplicated", () => {
  const notice = { ...record("gem-bids", "tender_published", "GEM/2026/B/12345"), externalKey: "shared-123" };
  const award = { ...record("cppp-contract-awards", "procured", "GEM/2026/B/12345"), externalKey: "shared-123" };
  const links = reconcileRecords([notice, award]);
  assert.equal(links.length, 1);
  assert.equal(links[0].fromSensorId, "gem-bids");
  assert.equal(links[0].toSensorId, "cppp-contract-awards");
  assert.equal(links[0].fromExternalKey, "shared-123");
  assert.equal(links[0].toExternalKey, "shared-123");
});

test("DB lookup never redirects a link to another sensor sharing its external key", () => {
  const notice = { ...record("gem-bids", "tender_published", "GEM/2026/B/12345"), externalKey: "shared-123" };
  const award = { ...record("cppp-contract-awards", "procured", "GEM/2026/B/12345"), externalKey: "shared-123" };
  const links = reconcileRecords([notice, award]);
  const rows = [
    { id: "award-uuid", sensor_id: "cppp-contract-awards", external_key: "shared-123" },
    { id: "unrelated-uuid", sensor_id: "unrelated-source", external_key: "shared-123" },
    { id: "notice-uuid", sensor_id: "gem-bids", external_key: "shared-123" }
  ];
  assert.deepEqual(resolveLinkRows(links, rows).map((row) => [
    row.from_live_record_id, row.to_live_record_id
  ]), [["notice-uuid", "award-uuid"]]);
  assert.deepEqual(resolveLinkRows(links, rows.slice(0, 2)), []);
});


test("E239: same reference from different authorities must not create a chain", () => {
  const a = record("source-a", "budgeted", "GEM/2026/B/12345");
  const b = { ...record("source-b", "procured", "GEM/2026/B/12345"), authority: "Unrelated Authority" };
  assert.deepEqual(reconcileRecords([a, b]), []);
});

test("E239: same reference across fiscal years must not create a chain", () => {
  const a = record("source-a", "budgeted", "GEM/2026/B/12345");
  const b = { ...record("source-b", "procured", "GEM/2026/B/12345"), fiscalYear: "2025-26" };
  assert.deepEqual(reconcileRecords([a, b]), []);
});

test("E239: unknown fiscal year fails closed rather than silently linking", () => {
  const a = { ...record("source-a", "budgeted", "GEM/2026/B/12345"), fiscalYear: undefined };
  const b = record("source-b", "procured", "GEM/2026/B/12345");
  assert.deepEqual(reconcileRecords([a, b]), []);
});

test("E239: ambiguous repeated lifecycle stages suppress the entire candidate chain", () => {
  const records = [
    record("budget", "budgeted", "GEM/2026/B/12345"),
    record("award-a", "procured", "GEM/2026/B/12345"),
    record("award-b", "procured", "GEM/2026/B/12345"),
    record("payment", "paid", "GEM/2026/B/12345")
  ];
  assert.deepEqual(reconcileRecords(records), []);
});

test("E239: source-scoped identity and valid ordered chain remain intact", () => {
  const a = { ...record("source-a", "budgeted", "GEM/2026/B/12345"), externalKey: "shared" };
  const b = { ...record("source-b", "procured", "gem / 2026 / b / 12345"), externalKey: "shared" };
  const links = reconcileRecords([a, b]);
  assert.equal(links.length, 1);
  assert.deepEqual([links[0].fromSensorId, links[0].toSensorId], ["source-a", "source-b"]);
  assert.equal(links[0].reference, "GEM/2026/B/12345");
});


test("E278: same tender reference but conflicting named vendors cannot prove shared award", () => {
  const notice = { ...record("notice", "tender_published", "GEM/2026/B/12345"), vendor: "Supplier Alpha" };
  const payment = { ...record("payment", "paid", "GEM/2026/B/12345"), vendor: "Supplier Beta" };
  assert.deepEqual(reconcileRecords([notice, payment]), []);
});

test("E278: consistent vendor identity still supports only co-reference, not a cash-flow edge", () => {
  const notice = { ...record("notice", "tender_published", "GEM/2026/B/12345"), vendor: "Supplier Alpha" };
  const payment = { ...record("payment", "paid", "GEM/2026/B/12345"), vendor: " supplier  alpha " };
  const links = reconcileRecords([notice, payment]);
  assert.equal(links.length, 1);
  assert.equal(links[0].confidence, 1); // exact reference equality, not transfer probability
  assert.match(links[0].relation, /fund flow unverified/);
  assert.doesNotMatch(links[0].relation, /→/);
});

test("E278: one unknown vendor does not fabricate a conflict", () => {
  const notice = record("notice", "tender_published", "GEM/2026/B/12345");
  const award = { ...record("award", "procured", "GEM/2026/B/12345"), vendor: "Supplier Alpha" };
  assert.equal(reconcileRecords([notice, award]).length, 1);
});

test("E278: a conflicting third vendor invalidates the whole candidate group", () => {
  const records = [
    { ...record("notice", "tender_published", "GEM/2026/B/12345"), vendor: "Supplier Alpha" },
    { ...record("award", "procured", "GEM/2026/B/12345"), vendor: "Supplier Beta" },
    record("payment", "paid", "GEM/2026/B/12345")
  ];
  assert.deepEqual(reconcileRecords(records), []);
  assert.deepEqual(reconcileRecords([...records].reverse()), []);
});
