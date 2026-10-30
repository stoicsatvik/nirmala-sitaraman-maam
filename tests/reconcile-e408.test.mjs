import assert from "node:assert/strict";
import test from "node:test";
import { reconcileRecords, resolvePersistedLinkRows } from "../scripts/lib/reconcile.ts";

const record = (overrides = {}) => ({
  externalKey: "shared-key",
  sensorId: "notice-sensor",
  title: "Synthetic notice",
  authority: "Municipal Authority",
  jurisdiction: "Mumbai",
  fiscalYear: "2026-27",
  state: "procured",
  observedAt: "2026-10-30T00:00:00Z",
  sourceUrl: "https://example.org/evidence",
  evidenceHash: "synthetic",
  tenderReference: "ABC12345",
  ...overrides
});

function link() {
  const links = reconcileRecords([
    record(),
    record({ externalKey: "award-key", sensorId: "award-sensor", state: "paid" })
  ]);
  assert.equal(links.length, 1);
  return links[0];
}

test("E408: unrelated sensor sharing an external key cannot hijack an endpoint", () => {
  const rows = resolvePersistedLinkRows([link()], [
    { id: "wrong", sensor_id: "unrelated", external_key: "shared-key" },
    { id: "notice", sensor_id: "notice-sensor", external_key: "shared-key" },
    { id: "award", sensor_id: "award-sensor", external_key: "award-key" }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from_live_record_id, "notice");
  assert.equal(rows[0].to_live_record_id, "award");
  assert.equal(rows[0].relation, "shared_tender_reference");
});

test("E408: missing scoped endpoint abstains even when an external key matches", () => {
  assert.deepEqual(resolvePersistedLinkRows([link()], [
    { id: "wrong", sensor_id: "unrelated", external_key: "shared-key" },
    { id: "award", sensor_id: "award-sensor", external_key: "award-key" }
  ]), []);
});

test("E408: duplicate composite identity abstains rather than choosing last row", () => {
  assert.deepEqual(resolvePersistedLinkRows([link()], [
    { id: "notice-1", sensor_id: "notice-sensor", external_key: "shared-key" },
    { id: "notice-2", sensor_id: "notice-sensor", external_key: "shared-key" },
    { id: "award", sensor_id: "award-sensor", external_key: "award-key" }
  ]), []);
});

test("E408: identical resolved UUIDs do not produce self-links", () => {
  assert.deepEqual(resolvePersistedLinkRows([link()], [
    { id: "same", sensor_id: "notice-sensor", external_key: "shared-key" },
    { id: "same", sensor_id: "award-sensor", external_key: "award-key" }
  ]), []);
});

test("E408: exact composite identities resolve reused keys across two sensors", () => {
  const candidate = {
    ...link(),
    fromExternalKey: "reused",
    toExternalKey: "reused"
  };
  const rows = resolvePersistedLinkRows([candidate], [
    { id: "notice", sensor_id: "notice-sensor", external_key: "reused" },
    { id: "award", sensor_id: "award-sensor", external_key: "reused" }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from_live_record_id, "notice");
  assert.equal(rows[0].to_live_record_id, "award");
});
