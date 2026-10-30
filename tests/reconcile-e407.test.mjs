import assert from "node:assert/strict";
import test from "node:test";
import { reconcileRecords } from "../scripts/lib/reconcile.ts";

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
    fromSensorId: "source-a",
    toSensorId: "source-a",
    fromExternalKey: "ref-1",
    toExternalKey: "ref-2",
    relation: "shared_tender_reference",
    basis: "exact_tender_reference",
    confidence: 1,
    reference: "ABC12345"
  }]);
});
