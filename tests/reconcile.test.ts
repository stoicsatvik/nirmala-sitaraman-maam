import test from "node:test";
import assert from "node:assert/strict";
import { reconcileRecords } from "../scripts/lib/reconcile";
import type { PublicMoneyRecord } from "../scripts/lib/ingestion";

function record(
  key: string,
  state: PublicMoneyRecord["state"],
  overrides: Partial<PublicMoneyRecord> = {}
): PublicMoneyRecord {
  return {
    externalKey: key,
    sensorId: "synthetic-test",
    title: "Synthetic record (not a government observation)",
    authority: "Municipality Alpha",
    jurisdiction: "Maharashtra",
    fiscalYear: "2026-27",
    state,
    observedAt: "2026-10-25T00:00:00Z",
    sourceUrl: "https://example.org/synthetic-fixture",
    tenderReference: "TENDER-001",
    evidenceHash: "synthetic-only",
    ...overrides
  };
}

test("E239: equal tender strings from different authorities are not evidence links", () => {
  const a = record("a", "procured");
  const b = record("b", "paid", { authority: "Municipality Beta" });
  assert.deepEqual(reconcileRecords([a, b]), []);
});

test("E239: same authority and reference in different jurisdictions must not link", () => {
  assert.deepEqual(reconcileRecords([
    record("a", "procured"),
    record("b", "paid", { jurisdiction: "Karnataka" })
  ]), []);
});

test("E239: same reference in different fiscal years must not link", () => {
  assert.deepEqual(reconcileRecords([
    record("a", "procured"),
    record("b", "paid", { fiscalYear: "2025-26" })
  ]), []);
});

test("E239: absent fiscal year must not be promoted to a verified chain", () => {
  assert.deepEqual(reconcileRecords([
    record("a", "procured", { fiscalYear: undefined }),
    record("b", "paid")
  ]), []);
});

test("E239: duplicate lifecycle stage makes the group ambiguous, so abstain", () => {
  assert.deepEqual(reconcileRecords([
    record("a", "budgeted"),
    record("b", "procured"),
    record("c", "procured"),
    record("d", "paid")
  ]), []);
});

test("E239: strictly ordered same-entity progression remains linkable", () => {
  const links = reconcileRecords([
    record("paid", "paid", { tenderReference: "tender- 001" }),
    record("budget", "budgeted", { tenderReference: "TENDER-001" }),
    record("procurement", "procured", { tenderReference: "TENDER-001" })
  ]);
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((x) => [x.fromExternalKey, x.toExternalKey]), [
    ["budget", "procurement"], ["procurement", "paid"]
  ]);
  assert.ok(links.every((x) => x.basis === "exact_tender_reference" && x.reference === "TENDER-001"));
});

test("E239: unrelated and absent references remain unlinked", () => {
  assert.deepEqual(reconcileRecords([
    record("a", "budgeted", { tenderReference: "TENDER-001" }),
    record("b", "paid", { tenderReference: "TENDER-002" }),
    record("c", "procured", { tenderReference: undefined })
  ]), []);
});

test("E239: record ordering does not alter unambiguous chain edges", () => {
  const records = [record("c", "audited"), record("a", "sanctioned"), record("b", "paid")];
  assert.deepEqual(reconcileRecords(records), reconcileRecords([...records].reverse()));
});
