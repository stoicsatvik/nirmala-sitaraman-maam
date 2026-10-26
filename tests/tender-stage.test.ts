import assert from "node:assert/strict";
import { test } from "node:test";
import { stageForObservation, TENDER_NOTICE_SENSOR_IDS } from "../scripts/lib/stages.ts";
import { reconcileRecords } from "../scripts/lib/reconcile.ts";
import type { PublicMoneyRecord } from "../scripts/lib/ingestion.ts";

function fixture(sensorId: string, state: PublicMoneyRecord["state"], key: string): PublicMoneyRecord {
  return {
    externalKey: key,
    sensorId,
    state,
    title: "Synthetic public evidence",
    authority: "Fixture",
    fiscalYear: "2026-27",
    jurisdiction: "India",
    observedAt: "2026-10-24T00:00:00Z",
    sourceUrl: "https://example.org/fixture",
    tenderReference: "GEM/2026/B/12345",
    evidenceHash: "fixture"
  };
}

test("all three notice collectors classify publication, not procurement", () => {
  assert.equal(TENDER_NOTICE_SENSOR_IDS.size, 3);
  for (const id of TENDER_NOTICE_SENSOR_IDS) {
    assert.equal(stageForObservation(id, "procured"), "tender_published");
    assert.equal(stageForObservation(id, "tender_published"), "tender_published");
  }
});

test("actual AOC records retain procured and later payment states", () => {
  assert.equal(stageForObservation("cppp-contract-awards", "procured"), "procured");
  assert.equal(stageForObservation("cppp-contract-awards", "paid"), "paid");
  assert.equal(stageForObservation("cga-monthly-accounts", "paid"), "paid");
});

test("legacy notice and independently observed award can form a stage link", () => {
  const links = reconcileRecords([
    fixture("gem-bids", "procured", "notice"),
    fixture("cppp-contract-awards", "procured", "award")
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].relation, "shared tender reference (tender_published / procured); fund flow unverified");
  assert.equal(links[0].confidence, 1);
});

test("two notice collectors never establish an award link", () => {
  assert.deepEqual(reconcileRecords([
    fixture("gem-bids", "procured", "notice-a"),
    fixture("cppp-procurement", "procured", "notice-b")
  ]), []);
});

test("cross-jurisdiction and absent references remain unlinked", () => {
  const notice = fixture("gem-bids", "procured", "notice");
  const award = { ...fixture("cppp-contract-awards", "procured", "award"), jurisdiction: "Mumbai" };
  assert.deepEqual(reconcileRecords([notice, award]), []);
  assert.deepEqual(reconcileRecords([{ ...notice, tenderReference: undefined }, award]), []);
});
